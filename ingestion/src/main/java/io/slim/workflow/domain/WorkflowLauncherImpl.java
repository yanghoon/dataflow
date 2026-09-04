package io.slim.workflow.domain;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import io.slim.workflow.domain.repo.WorkflowJobRepository;
import io.slim.workflow.domain.repo.WorkflowRepository;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class WorkflowLauncherImpl implements WorkflowLauncher {
    private final WorkflowRepository workflowRepository;
    private final WorkflowJobRepository jobRepository;

    @Override
    public void launch(String jobName, WorkflowParams params) {
        Instant start = Instant.now();
        WorkflowJob job = jobRepository.findByJobName(jobName).get();
        Workflow workflow = workflowRepository.findByWorkflowType(job.type())
                .orElseThrow(() -> new IllegalStateException("알 수 없는 workflowType: " + job.type()));

        Set<String> allowed = job.allowedOverrides() != null ? job.allowedOverrides() : Set.of();
        Map<String, String> safeMap = new HashMap<>(job.props() != null ? job.props() : Map.of());
        if (params != null && params.values() != null) {
            params.values().forEach((k, v) -> {
                if (!allowed.contains(k)) throw new IllegalArgumentException("허용되지 않은 파라미터입니다: " + k);
                safeMap.put(k, v);
            });
        }
        WorkflowParams finalParams = new WorkflowParams(safeMap);

        try {
            workflow.execute(job, finalParams);
        } catch (Exception e) {
            throw e;
        }
    }

    @Override
    public void validate(String jobName, Map<String, String> overrideParams) {
        WorkflowJob job = jobRepository.findByJobName(jobName)
                .orElseThrow(() -> new IllegalArgumentException("Unknown job: " + jobName));
        Workflow workflow = workflowRepository.findByWorkflowType(job.type())
                .orElseThrow(() -> new IllegalStateException("알 수 없는 workflowType: " + job.type()));

        Set<String> allowed = job.allowedOverrides() != null ? job.allowedOverrides() : Set.of();
        if (overrideParams != null) {
            overrideParams.keySet().forEach(k -> {
                if (!allowed.contains(k)) throw new IllegalArgumentException("허용되지 않은 파라미터입니다: " + k);
            });
        }

        Map<String, String> safeMap = new HashMap<>(job.props() != null ? job.props() : Map.of());
        if (overrideParams != null) {
            safeMap.putAll(overrideParams);
        }
        WorkflowParams finalParams = new WorkflowParams(safeMap);

        workflow.validate(job, finalParams);
    }
}
