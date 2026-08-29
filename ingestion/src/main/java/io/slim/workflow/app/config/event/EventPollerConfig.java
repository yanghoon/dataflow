package io.slim.workflow.app.config.event;

import io.slim.workflow.app.adapter.event.EventCandidateRepository;
import io.slim.workflow.app.adapter.event.JdbcEventMessagePoller;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

import java.time.Duration;

@Configuration
@EnableScheduling
public class EventPollerConfig implements SchedulingConfigurer {

    private final EventCandidateRepository repository;
    private final ApplicationEventPublisher eventPublisher;

    public EventPollerConfig(EventCandidateRepository repository, ApplicationEventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    @Bean
    public JdbcEventMessagePoller toolAPoller() {
        String extractSql = "SELECT * FROM outbox_event WHERE status = 'READY' AND type LIKE 'toolA.%' FOR UPDATE SKIP LOCKED";
        String updateSql = "UPDATE outbox_event SET status = 'DONE', updated_at = CURRENT_TIMESTAMP WHERE id IN (:ids)";
        return new JdbcEventMessagePoller(repository, eventPublisher, extractSql, updateSql, "ToolA-Poller");
    }

    @Bean
    public JdbcEventMessagePoller toolBPoller() {
        String extractSql = "SELECT * FROM outbox_event WHERE status = 'READY' AND type LIKE 'toolB.%' FOR UPDATE SKIP LOCKED";
        String updateSql = "UPDATE outbox_event SET status = 'DONE', updated_at = CURRENT_TIMESTAMP WHERE id IN (:ids)";
        return new JdbcEventMessagePoller(repository, eventPublisher, extractSql, updateSql, "ToolB-Poller");
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        // Run every 1 second (1000ms)
        taskRegistrar.addFixedDelayTask(() -> toolAPoller().pollAndDispatch(), Duration.ofMillis(1000));
        taskRegistrar.addFixedDelayTask(() -> toolBPoller().pollAndDispatch(), Duration.ofMillis(1000));
    }
}
