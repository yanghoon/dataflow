package io.slim.batch.console.scheduler;

import java.time.Instant;
import java.util.Map;

import org.springframework.stereotype.Repository;

import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;
import com.github.kagkarlsson.scheduler.task.schedule.CronSchedule;

import io.slim.workflow.app.adapter.scheduler.WorkflowScheduleData;
import io.slim.workflow.domain.WorkflowJob;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class DbJobSchedulerRepository implements JobSchedulerRepository {

    private final SchedulerClient schedulerClient;

    @Override
    public void save(String id, String jobName, String cronExpression, Map<String, String> parameters) {
        // "workflowjob" is the task name used in WorkflowSchedulerConfig
        var taskInstanceId = TaskInstanceId.of("workflowjob", id);
        
        var cronSchedule = new CronSchedule(cronExpression);
        var workflowJob = new WorkflowJob(jobName, null, cronExpression, true, "SCHEDULED", parameters, null);
        var data = WorkflowScheduleData.of(cronSchedule, null, workflowJob);

        // For recurring tasks with persistent schedule, the first execution time can be now or calculated.
        // We'll calculate the next execution time based on the cron schedule from now.
        Instant nextExecution = cronSchedule.getInitialExecutionTime(Instant.now());

        schedulerClient.schedule(taskInstanceId.getTaskInstance(data), nextExecution);
    }

    @Override
    public void delete(String id) {
        schedulerClient.cancel(TaskInstanceId.of("workflowjob", id));
    }
}
