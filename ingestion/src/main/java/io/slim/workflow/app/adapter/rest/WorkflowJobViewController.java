package io.slim.workflow.app.adapter.rest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstance;
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
        WorkflowJob job = yamlJobs.jobs().get(jobName);
        if (job == null) throw new IllegalArgumentException("Unknown job: " + jobName);

        Set<String> allowed = job.allowedOverrides() != null ? job.allowedOverrides() : Set.of();
        if (overrideParams != null) {
            for (String key : overrideParams.keySet()) {
                if (!allowed.contains(key)) {
                    throw new IllegalArgumentException("허용되지 않은 파라미터 오버라이드 시도입니다: " + key);
                }
            }
        }

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
}

record WorkflowJobView(
    String jobName, String group, String workflowType, String cronExpression,
    boolean enabled, Instant nextExecutionTime, boolean running,
    Set<String> allowedOverrides, Map<String, String> props
) {}

record RunAdhocResponse(String taskInstanceId) {}
