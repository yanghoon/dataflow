package io.slim.ingestion.batch.v2.app.infra.repository;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;
import com.github.kagkarlsson.scheduler.task.schedule.Schedules;
import java.time.Instant;

@Component
public class SettingChangedEventListener {

    private final SchedulerClient schedulerClient;

    public SettingChangedEventListener(SchedulerClient schedulerClient) {
        this.schedulerClient = schedulerClient;
    }

    @EventListener
    public void handleSettingChanged(SettingChangedEvent event) {
        String key = event.getKey();
        String value = event.getValue();

        // format: cron.{jobName}
        if (key != null && key.startsWith("cron.")) {
            String jobName = key.substring(5);
            var taskInstanceId = TaskInstanceId.of("workflowjob", jobName);
            var desiredSchedule = Schedules.cron(value);
            
            var existingExecution = schedulerClient.getScheduledExecution(taskInstanceId);
            
            if (existingExecution.isPresent()) {
                schedulerClient.reschedule(taskInstanceId, desiredSchedule.getInitialExecutionTime(Instant.now()));
            }
        }
    }
}
