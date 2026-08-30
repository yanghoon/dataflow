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
            TaskInstanceId id = TaskInstanceId.of(spec.group(), spec.name());
            var scheduled = schedulerClient.getScheduledExecution(id);
            views.add(new WorkflowJobView(
                spec.name(), spec.group(), spec.type(), spec.cron(),
                spec.enabled(),
                scheduled.map(e -> e.getExecutionTime()).orElse(null),
                scheduled.map(e -> e.isPicked()).orElse(false)
            ));
        }
        return views;
    }

    @org.springframework.web.bind.annotation.PostMapping("/{jobName}/run")
    public void runAdhoc(
        @org.springframework.web.bind.annotation.PathVariable String jobName,
        @org.springframework.web.bind.annotation.RequestBody(required = false) java.util.Map<String, String> overrideParams
    ) {
        WorkflowJob job = yamlJobs.jobs().get(jobName);
        if (job == null) throw new IllegalArgumentException("Unknown job: " + jobName);

        java.util.Set<String> allowed = job.allowedOverrides() != null ? job.allowedOverrides() : java.util.Set.of();
        if (overrideParams != null) {
            for (String key : overrideParams.keySet()) {
                if (!allowed.contains(key)) {
                    throw new IllegalArgumentException("허용되지 않은 파라미터 오버라이드 시도입니다: " + key);
                }
            }
        }

        java.util.Map<String, String> finalMergedParams = new java.util.HashMap<>(job.props() != null ? job.props() : java.util.Map.of());
        if (overrideParams != null) {
            finalMergedParams.putAll(overrideParams);
        }

        java.util.HashMap<String, Object> taskData = new java.util.HashMap<>();
        taskData.put("jobName", jobName);
        taskData.put("overrideParams", overrideParams);
        taskData.put("finalMergedParams", finalMergedParams);

        String instanceId = "adhoc-" + jobName + "-" + java.util.UUID.randomUUID();
        com.github.kagkarlsson.scheduler.task.TaskInstance<java.util.HashMap> instance = 
            new com.github.kagkarlsson.scheduler.task.TaskInstance<>(
                "workflowjob-adhoc", 
                instanceId, 
                taskData
            );
        schedulerClient.schedule(instance, Instant.now());
    }
}

record WorkflowJobView(
    String jobName, String group, String workflowType, String cronExpression,
    boolean enabled, Instant nextExecutionTime, boolean running
) {}
