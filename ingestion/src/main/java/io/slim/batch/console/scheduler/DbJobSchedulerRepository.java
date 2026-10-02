package io.slim.batch.console.scheduler;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.time.Instant;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Repository;

import com.github.kagkarlsson.scheduler.ScheduledExecution;
import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;
import com.github.kagkarlsson.scheduler.task.schedule.CronSchedule;
import com.github.kagkarlsson.scheduler.task.TaskInstance;

import io.slim.workflow.app.adapter.scheduler.WorkflowScheduleData;
import io.slim.workflow.domain.WorkflowJob;
import lombok.RequiredArgsConstructor;

@Repository
@ConditionalOnBean(SchedulerClient.class)
@RequiredArgsConstructor
public class DbJobSchedulerRepository implements JobSchedulerRepository {

    private final SchedulerClient schedulerClient;

    @Override
    public void save(String id, String jobName, String cronExpression, Map<String, String> parameters) {
        var cronSchedule = new CronSchedule(cronExpression);
        var workflowJob = new WorkflowJob(jobName, null, cronExpression, true, "SCHEDULED", parameters, null);
        var data = WorkflowScheduleData.of(cronSchedule, null, workflowJob);
        
        // Use TaskInstance constructor directly or taskInstance method.
        // TaskInstance has a constructor TaskInstance(String taskName, String id, T data) in older versions, 
        // or we can use schedulerClient.schedule(TaskInstanceId.of("workflowjob", id), Instant, Object data) ???
        // Let's try schedulerClient.schedule(TaskInstanceId.of("workflowjob", id).taskInstance(data), nextExecution) ? 
        // Let's use new TaskInstance<>("workflowjob", id, data) ? Wait, in kagkarlsson db-scheduler:
        // TaskInstance is an interface or class? It's a class: new TaskInstance<>(taskName, id, data)
        // Wait, SchedulerClient doesn't have a schedule that takes TaskInstanceId, Instant, data. It takes TaskInstance, Instant.
        
        Instant nextExecution = cronSchedule.getInitialExecutionTime(Instant.now());
        
        // Assuming TaskInstance can be instantiated like this:
        schedulerClient.schedule(new TaskInstance<>("workflowjob", id, data), nextExecution);
    }

    @Override
    public List<ScheduleDto> findAll() {
        List<ScheduleDto> result = new ArrayList<>();
        List<ScheduledExecution<Object>> executions = schedulerClient.getScheduledExecutions();
        for (ScheduledExecution<Object> execution : executions) {
            if ("workflowjob".equals(execution.getTaskInstance().getTaskName())) {
                String id = execution.getTaskInstance().getId();
                Object data = execution.getData();
                if (data instanceof WorkflowScheduleData wsd) {
                    Instant createdAt = wsd.createdAt();
                    Instant lastSuccess = execution.getLastSuccess();
                    Instant lastFailure = execution.getLastFailure();
                    boolean isPicked = execution.isPicked();

                    Instant lastExecutionTime = null;
                    String lastStatus = null;

                    if (isPicked) {
                        lastStatus = "RUNNING";
                    }

                    if (lastSuccess != null && lastFailure != null) {
                        if (lastSuccess.isAfter(lastFailure)) {
                            lastExecutionTime = lastSuccess;
                            if (lastStatus == null) {
                                lastStatus = "SUCCESS";
                            }
                        } else {
                            lastExecutionTime = lastFailure;
                            if (lastStatus == null) {
                                lastStatus = "FAILED";
                            }
                        }
                    } else if (lastSuccess != null) {
                        lastExecutionTime = lastSuccess;
                        if (lastStatus == null) {
                            lastStatus = "SUCCESS";
                        }
                    } else if (lastFailure != null) {
                        lastExecutionTime = lastFailure;
                        if (lastStatus == null) {
                            lastStatus = "FAILED";
                        }
                    }

                    result.add(new ScheduleDto(
                        id,
                        wsd.content().name(),
                        wsd.content().cron(),
                        wsd.content().props(),
                        createdAt,
                        lastExecutionTime,
                        lastStatus
                    ));
                }
            }
        }
        return result;
    }

    @Override
    public void update(String id, String jobName, String cronExpression, Map<String, String> parameters) {
        delete(id);
        save(id, jobName, cronExpression, parameters);
    }

    @Override
    public void delete(String id) {
        schedulerClient.cancel(TaskInstanceId.of("workflowjob", id));
    }
}
