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
    public List<String> configuredGroups(WorkflowJobsYaml yamlJobs) {
        if (yamlJobs.jobs() == null) return List.of();
        return yamlJobs.jobs().values().stream()
                .map(job -> job.group())
                .distinct()
                .collect(Collectors.toList());
    }

    @Bean
    public List<RecurringTaskWithPersistentSchedule<WorkflowScheduleData>> workflowGroupTasks(
        WorkflowTriggerExecutor executor,
        List<String> configuredGroups) {
        
        List<RecurringTaskWithPersistentSchedule<WorkflowScheduleData>> tasks = new ArrayList<>();
        for (String group : configuredGroups) {
            tasks.add(createGroupTask(group, executor));
        }
        return tasks;
    }

    private RecurringTaskWithPersistentSchedule<WorkflowScheduleData> createGroupTask(
        String group, WorkflowTriggerExecutor executor) {
        log.info("[TASK-REGISTER] Task '{}' 정의 생성", group);
        return Tasks.recurringWithPersistentSchedule(group, WorkflowScheduleData.class)
            .onFailure(new FailureHandler.MaxRetriesFailureHandler<>(3,
                new FailureHandler.ExponentialBackoffFailureHandler<>(Duration.ofSeconds(30), 2)))
            .execute((taskInstance, ctx) -> {
                log.info("[TASK-EXECUTE] group={} jobName={} 실행 시작", group, taskInstance.getId());
                executor.run(taskInstance.getId(), taskInstance.getData());
                log.info("[TASK-EXECUTE] group={} jobName={} 실행 종료", group, taskInstance.getId());
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
