package io.slim.workflow.app.config.event;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

import java.time.Duration;
import io.slim.workflow.app.adapter.event.dispatcher.CloudEventDispatcher;
import io.slim.workflow.app.adapter.event.poller.JdbcEventMessagePoller;
import io.slim.workflow.app.adapter.event.repo.EventCandidateRepository;


@Configuration
@EnableScheduling
public class EventPollerConfig implements SchedulingConfigurer {

    private final EventCandidateRepository repository;
    private final CloudEventDispatcher eventDispatcher;
    
    @Value("${app.outbox.default.retry.max-attempts:3}")
    private int maxAttempts;
    
    @Value("${app.outbox.default.retry.initial-interval:1000}")
    private long initialInterval;

    public EventPollerConfig(EventCandidateRepository repository, CloudEventDispatcher eventDispatcher) {
        this.repository = repository;
        this.eventDispatcher = eventDispatcher;
    }

    @Bean
    public JdbcEventMessagePoller unifiedPoller() {
        String extractSql = "SELECT * FROM outbox_event WHERE (status = 'PENDING' OR status = 'RETRY_PENDING') AND (extensions->>'next_retry_at' IS NULL OR extensions->>'next_retry_at' <= to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')) FOR UPDATE SKIP LOCKED";
        String updateSql = "UPDATE outbox_event SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE id IN (:ids)";
        return new JdbcEventMessagePoller(repository, eventDispatcher, extractSql, updateSql, "Unified-Poller", maxAttempts, initialInterval);
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        // Run every 1 second (1000ms)
        taskRegistrar.addFixedDelayTask(() -> unifiedPoller().pollAndDispatch(), Duration.ofMillis(1000));
    }
}
