package io.slim.workflow.app.adapter.rest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.boot.context.properties.bind.BindException;

import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstance;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;

import io.slim.workflow.app.config.workflow.WorkflowProperties;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowLauncher;

@RestController
@RequestMapping("/admin/workflow-jobs")
public class WorkflowJobViewController {
    private final WorkflowProperties yamlJobs;
    private final SchedulerClient schedulerClient;
    private final WorkflowLauncher workflowLauncher;

    public WorkflowJobViewController(WorkflowProperties yamlJobs, SchedulerClient schedulerClient, WorkflowLauncher workflowLauncher) {
        this.yamlJobs = yamlJobs;
        this.schedulerClient = schedulerClient;
        this.workflowLauncher = workflowLauncher;
    }

    @GetMapping
    public List<WorkflowJobView> listAll() {
        if (yamlJobs.jobs() == null) return List.of();
        
        List<WorkflowJobView> views = new ArrayList<>();
        for (WorkflowJob spec : yamlJobs.jobs().values()) {
            TaskInstanceId id = TaskInstanceId.of(spec.group(), spec.name());
            var scheduled = schedulerClient.getScheduledExecution(id);
            views.add(new WorkflowJobView(
                spec.name(), spec.group(), spec.type(), spec.cron(),
                spec.enabled(),
                scheduled.map(e -> e.getExecutionTime()).orElse(null),
                scheduled.map(e -> e.isPicked()).orElse(false),
                spec.allowedOverrides(),
                spec.props()
            ));
        }
        return views;
    }

    @PostMapping("/{jobName}/run")
    public RunAdhocResponse runAdhoc(
        @PathVariable String jobName,
        @RequestBody(required = false) Map<String, String> overrideParams
    ) {
        workflowLauncher.validate(jobName, overrideParams);

        WorkflowJob job = yamlJobs.jobs().get(jobName);
        if (job == null) throw new IllegalArgumentException("Unknown job: " + jobName);

        Map<String, String> finalMergedParams = new HashMap<>(job.props() != null ? job.props() : Map.of());
        if (overrideParams != null) {
            finalMergedParams.putAll(overrideParams);
        }

        HashMap<String, Object> taskData = new HashMap<>();
        taskData.put("jobName", jobName);
        taskData.put("overrideParams", overrideParams);
        taskData.put("finalMergedParams", finalMergedParams);

        String instanceId = "adhoc-" + jobName + "-" + UUID.randomUUID();
        TaskInstance<HashMap> instance = new TaskInstance<>(
            "workflowjob-adhoc", 
            instanceId, 
            taskData
        );
        schedulerClient.schedule(instance, Instant.now());
        
        return new RunAdhocResponse(instanceId);
    }

    @ExceptionHandler({
        IllegalArgumentException.class,
        BindException.class
    })
    public ResponseEntity<Map<String, String>> handleValidationExceptions(Exception ex) {
        if (ex instanceof BindException) {
            BindException bindEx = (BindException) ex;
            String propName = bindEx.getProperty() != null ? bindEx.getProperty().toString() : "unknown";
            return ResponseEntity.badRequest().body(Map.of("error", "Binding failed for field '" + propName + "': " + bindEx.getMessage()));
        }
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }
}

record WorkflowJobView(
    String jobName, String group, String workflowType, String cronExpression,
    boolean enabled, Instant nextExecutionTime, boolean running,
    Set<String> allowedOverrides, Map<String, String> props
) {}

record RunAdhocResponse(String taskInstanceId) {}
