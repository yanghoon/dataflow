package io.slim.workflow.app.adapter.event;

import io.cloudevents.CloudEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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

        for (CloudEvent event : events) {
            // Dispatch via Spring Event
            eventPublisher.publishEvent(event);
        }

        List<String> ids = events.stream().map(CloudEvent::getId).toList();
        repository.updateStatusToDone(updateSql, ids);
        
        log.info("[{}] Successfully dispatched and committed {} events.", pollerName, events.size());
    }
}
