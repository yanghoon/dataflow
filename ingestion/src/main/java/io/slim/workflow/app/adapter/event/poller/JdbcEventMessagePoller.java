package io.slim.workflow.app.adapter.event.poller;

import io.cloudevents.CloudEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import io.slim.workflow.app.adapter.event.dispatcher.CloudEventDispatcher;
import io.slim.workflow.app.adapter.event.exception.DispatchException;
import io.slim.workflow.app.adapter.event.model.EventStatus;
import io.slim.workflow.app.adapter.event.repo.EventCandidateRepository;


@Slf4j
@RequiredArgsConstructor
public class JdbcEventMessagePoller {

    private final EventCandidateRepository repository;
    private final CloudEventDispatcher eventDispatcher;
    
    private final String extractSql;
    private final String updateSql;
    private final String pollerName;
    private final int maxAttempts;
    private final long initialInterval;

    @Transactional
    public void pollAndDispatch() {
        log.debug("[{}] Polling for new events...", pollerName);
        
        List<CloudEvent> events = repository.findCandidates(extractSql);
        if (events.isEmpty()) {
            return;
        }

        log.info("[{}] Found {} events to process.", pollerName, events.size());

        List<String> successfulIds = new ArrayList<>();
        List<String> failedIds = new ArrayList<>();

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<CompletableFuture<Void>> futures = events.stream()
                    .<CompletableFuture<Void>>map(event -> CompletableFuture.runAsync(() -> {
                        try {
                            eventDispatcher.dispatch(event);
                            synchronized (successfulIds) {
                                successfulIds.add(event.getId());
                            }
                        } catch (DispatchException e) {
                            if (e.getTargetStatus() == EventStatus.FAILED) {
                                log.error("[{}] Permanent failure for event {}: {}", pollerName, event.getId(), e.getMessage());
                                synchronized (failedIds) {
                                    failedIds.add(event.getId());
                                }
                            } else if (e.getTargetStatus() == EventStatus.RETRY_PENDING) {
                                handleRetryableFailure(event, e, failedIds);
                            } else {
                                log.warn("[{}] Unhandled TargetStatus: {}", pollerName, e.getTargetStatus());
                                handleRetryableFailure(event, e, failedIds);
                            }
                        } catch (Exception e) {
                            handleRetryableFailure(event, e, failedIds);
                        }
                    }, executor))
                    .toList();

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .exceptionally(e -> null)
                    .join();

            if (!successfulIds.isEmpty()) {
                repository.updateStatusToDone(updateSql, successfulIds);
                log.info("[{}] Successfully dispatched and committed {} events.", pollerName, successfulIds.size());
            }
            if (!failedIds.isEmpty()) {
                repository.updateStatusToFailed(failedIds);
                log.info("[{}] Marked {} events as FAILED.", pollerName, failedIds.size());
            }
        }
    }

    private void handleRetryableFailure(CloudEvent event, Exception e, List<String> failedIds) {
        Object retryObj = event.getExtension("retrycount");
        int currentRetry = 0;
        if (retryObj instanceof Number) {
            currentRetry = ((Number) retryObj).intValue();
        } else if (retryObj instanceof String) {
            try {
                currentRetry = Integer.parseInt((String) retryObj);
            } catch (NumberFormatException ignored) {}
        }

        int nextRetry = currentRetry + 1;
        if (nextRetry >= maxAttempts) {
            log.error("[{}] Max retry attempts ({}) reached for event {}. Marking as FAILED. Error: {}", pollerName, maxAttempts, event.getId(), e.getMessage());
            synchronized (failedIds) {
                failedIds.add(event.getId());
            }
        } else {
            long backoffMs = initialInterval * (long) Math.pow(2, currentRetry);
            Instant nextRetryAt = Instant.now().plusMillis(backoffMs);
            log.warn("[{}] Retryable failure for event {} (attempt {}/{}). Next retry at {}. Error: {}", pollerName, event.getId(), nextRetry, maxAttempts, nextRetryAt, e.getMessage());
            String nextRetryAtStr = DateTimeFormatter.ISO_INSTANT.format(nextRetryAt);
            repository.updateRetry(event.getId(), nextRetry, nextRetryAtStr);
        }
    }
}
