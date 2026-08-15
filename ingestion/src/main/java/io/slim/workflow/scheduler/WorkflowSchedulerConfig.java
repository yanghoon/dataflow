package io.slim.workflow.scheduler;

import com.github.kagkarlsson.scheduler.Scheduler;
import com.github.kagkarlsson.scheduler.task.helper.RecurringTaskWithPersistentSchedule;
import com.github.kagkarlsson.scheduler.task.helper.Tasks;
import com.github.kagkarlsson.scheduler.task.FailureHandler;
import org.springframework.context.annotation.*;

import javax.sql.DataSource;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;
import io.slim.workflow.config.WorkflowJobsYaml;

@Configuration
public class WorkflowSchedulerConfig {
    private static final org.slf4j.Logger log =
        org.slf4j.LoggerFactory.getLogger(WorkflowSchedulerConfig.class);

    @Bean
    public RecurringTaskWithPersistentSchedule<WorkflowScheduleData> workflowJobTask(
        WorkflowTriggerExecutor executor) {
        
        String taskName = "workflowjob";
        log.info("[TASK-REGISTER] Task '{}' 정의 생성", taskName);
        
        return Tasks.recurringWithPersistentSchedule(taskName, WorkflowScheduleData.class)
            .onFailure(new FailureHandler.MaxRetriesFailureHandler<>(3,
                new FailureHandler.ExponentialBackoffFailureHandler<>(Duration.ofSeconds(30), 2)))
            .execute((taskInstance, ctx) -> {
                log.info("[TASK-EXECUTE] taskName={} jobName={} 실행 시작", taskName, taskInstance.getId());
                executor.run(taskInstance.getId(), taskInstance.getData());
                log.info("[TASK-EXECUTE] taskName={} jobName={} 실행 종료", taskName, taskInstance.getId());
            });
    }

    @Bean
    public com.github.kagkarlsson.scheduler.task.Task<Void> simpleTestTask() {
        return Tasks.oneTime("simple-one-time-task")
            .execute((instance, ctx) -> {
                log.info("Hello from simpleTestTask! This is a one-time execution.");
            });
    }

    @Bean
    public org.springframework.boot.CommandLineRunner scheduleTestTask(Scheduler scheduler, com.github.kagkarlsson.scheduler.task.Task<Void> simpleTestTask) {
        return args -> {
            try {
                String instanceId = "instance-" + java.util.UUID.randomUUID().toString();
                scheduler.schedule(simpleTestTask.instance(instanceId), java.time.Instant.now().plusSeconds(5));
                log.info("Scheduled simple-one-time-task with id: {}", instanceId);
            } catch (Exception e) {
                log.info("Error scheduling simple-one-time-task: {}", e.getMessage());
            }
        };
    }

}
