package io.slim.workflow.app.adapter.rest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;

import io.slim.workflow.app.config.workflow.WorkflowProperties;
import io.slim.workflow.domain.WorkflowJob;

@RestController
@RequestMapping("/admin/workflow-jobs")
public class WorkflowJobViewController {
    private final WorkflowProperties yamlJobs;
    private final SchedulerClient schedulerClient;

    public WorkflowJobViewController(WorkflowProperties yamlJobs, SchedulerClient schedulerClient) {
        this.yamlJobs = yamlJobs;
        this.schedulerClient = schedulerClient;
    }

    @GetMapping
    public List<WorkflowJobView> listAll() {
        if (yamlJobs.jobs() == null) return List.of();
        
        List<WorkflowJobView> views = new ArrayList<>();
        for (WorkflowJob spec : yamlJobs.jobs().values()) {
            TaskInstanceId id = TaskInstanceId.of(spec.group(), spec.jobName());
            var scheduled = schedulerClient.getScheduledExecution(id);
            views.add(new WorkflowJobView(
                spec.jobName(), spec.group(), spec.workflowType(), spec.cron(),
                spec.enabled(),
                scheduled.map(e -> e.getExecutionTime()).orElse(null),
                scheduled.map(e -> e.isPicked()).orElse(false)
            ));
        }
        return views;
    }
}

record WorkflowJobView(
    String jobName, String group, String workflowType, String cronExpression,
    boolean enabled, Instant nextExecutionTime, boolean running
) {}
