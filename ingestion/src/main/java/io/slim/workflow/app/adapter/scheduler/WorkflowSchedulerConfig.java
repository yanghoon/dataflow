package io.slim.workflow.app.adapter.scheduler;

import java.time.Duration;

import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.github.kagkarlsson.scheduler.Scheduler;
import com.github.kagkarlsson.scheduler.task.FailureHandler;
import com.github.kagkarlsson.scheduler.task.Task;
import com.github.kagkarlsson.scheduler.task.helper.RecurringTaskWithPersistentSchedule;
import com.github.kagkarlsson.scheduler.task.helper.Tasks;

import io.slim.workflow.domain.WorkflowLauncher;
import io.slim.workflow.domain.WorkflowLauncher.WorkflowLauncherImpl;
import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
public class WorkflowSchedulerConfig {

    @Bean
    public RecurringTaskWithPersistentSchedule<WorkflowScheduleData> workflowJobTask(
        WorkflowLauncher workflowLauncher
    ) {
        
        String taskName = "workflowjob";
        log.info("[TASK-REGISTER] Task '{}' 정의 생성", taskName);
        
        // TODO: Retry from WorkflowJob Config on Failure. (to avoid thread pool lock)
        return Tasks.recurringWithPersistentSchedule(taskName, WorkflowScheduleData.class)
            .onFailure(FailureHandler.<WorkflowScheduleData>
                maxRetries(5)
                .withBackoff(Duration.ofSeconds(30), 2)
                .then(
                    new FailureHandler.OnFailureRescheduleUsingTaskDataSchedule<>(),
                    // (complete, ops) -> {}
                    // (executionComplete, executionOperations) -> {
                    (executionComplete) -> {
                        var jobName = executionComplete.getExecution().taskInstance.getId();
                        log.error("[TASK-GIVEUP] taskName={} jobName={} 3회 재시도 소진, 다음 정기 스케줄로 복귀", taskName, jobName);
                    }
                )
            )
            .execute((taskInstance, ctx) -> {
                log.info("[TASK-EXECUTE] taskName={} jobName={} 실행 시작", taskName, taskInstance.getId());

                var jobName = taskInstance.getId();
                workflowLauncher.launch(jobName, null);

                log.info("[TASK-EXECUTE] taskName={} jobName={} 실행 종료", taskName, taskInstance.getId());
            });
    }

    @Bean
    WorkflowLauncher workflowLauncher(AutowireCapableBeanFactory factory) {
        return factory.createBean(WorkflowLauncherImpl.class);
    }

    @Bean
    WorkflowScheduleBootstrapper workflowScheduleRegister(AutowireCapableBeanFactory factory) {
        return factory.createBean(WorkflowScheduleBootstrapper.class);
    }

    @Bean
    public Task<Void> simpleTestTask() {
        return Tasks.oneTime("simple-one-time-task")
            .execute((instance, ctx) -> {
                log.info("Hello from simpleTestTask! This is a one-time execution.");
            });
    }

    @Bean
    public CommandLineRunner scheduleTestTask(Scheduler scheduler, Task<Void> simpleTestTask) {
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
