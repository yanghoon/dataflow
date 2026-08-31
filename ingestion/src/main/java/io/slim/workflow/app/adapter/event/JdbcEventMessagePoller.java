package io.slim.workflow.app.adapter.event;

import io.cloudevents.CloudEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;

@Slf4j
@RequiredArgsConstructor
public class JdbcEventMessagePoller {

    private final EventCandidateRepository repository;
    private final ApplicationEventPublisher eventPublisher;
    
    private final String extractSql;
    private final String updateSql;
    private final String pollerName;

    @Transactional
    public void pollAndDispatch() {
        log.debug("[{}] Polling for new events...", pollerName);
        
        List<CloudEvent> events = repository.findCandidates(extractSql);
        if (events.isEmpty()) {
            return;
        }

        log.info("[{}] Found {} events to process.", pollerName, events.size());

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<CompletableFuture<String>> futures = events.stream()
                    .<CompletableFuture<String>>map(event -> CompletableFuture.supplyAsync(() -> {
                        eventPublisher.publishEvent(event);
                        return event.getId();
                    }, executor))
                    .toList();

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .exceptionally(e -> null)
                    .join();

            List<String> successfulIds = futures.stream()
                    .filter(f -> !f.isCompletedExceptionally())
                    .map(CompletableFuture::join)
                    .toList();

            if (!successfulIds.isEmpty()) {
                repository.updateStatusToDone(updateSql, successfulIds);
                log.info("[{}] Successfully dispatched and committed {} events.", pollerName, successfulIds.size());
            }
        }
    }
}
