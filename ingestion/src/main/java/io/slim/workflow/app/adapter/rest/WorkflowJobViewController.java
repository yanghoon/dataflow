package io.slim.workflow.app.adapter.rest;

import io.slim.workflow.app.config.workflow.WorkflowJobsYaml;
import io.slim.workflow.domain.WorkflowJobSpec;
import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/admin/workflow-jobs")
public class WorkflowJobViewController {
    private final WorkflowJobsYaml yamlJobs;
    private final SchedulerClient schedulerClient;

    public WorkflowJobViewController(WorkflowJobsYaml yamlJobs, SchedulerClient schedulerClient) {
        this.yamlJobs = yamlJobs;
        this.schedulerClient = schedulerClient;
    }

    @GetMapping
    public List<WorkflowJobView> listAll() {
        if (yamlJobs.jobs() == null) return List.of();
        
        List<WorkflowJobView> views = new ArrayList<>();
        for (WorkflowJobSpec spec : yamlJobs.jobs().values()) {
            TaskInstanceId id = TaskInstanceId.of(spec.group(), spec.jobName());
            var scheduled = schedulerClient.getScheduledExecution(id);
            views.add(new WorkflowJobView(
                spec.jobName(), spec.group(), spec.workflowType(), spec.cronExpression(),
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
