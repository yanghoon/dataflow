package io.slim.workflow.domain;

import java.time.Instant;

import io.slim.workflow.domain.repo.WorkflowJobRepository;
import io.slim.workflow.domain.repo.WorkflowRepository;
import lombok.RequiredArgsConstructor;

public interface WorkflowLauncher {
    void launch(String jobName, WorkflowParams params);

    @RequiredArgsConstructor
    public static class WorkflowLauncherImpl implements WorkflowLauncher {
        private final WorkflowRepository workflowRepository;
        private final WorkflowJobRepository jobRepository;

        @Override
        public void launch(String jobName, WorkflowParams params) {
            Instant start = Instant.now();
            WorkflowJob job= jobRepository.findByJobName(jobName).get();
            Workflow workflow = workflowRepository.findByWorkflowType(job.type())
                    .orElseThrow(() -> new IllegalStateException("알 수 없는 workflowType: " + job.type()));

            java.util.Set<String> allowed = job.allowedOverrides() != null ? job.allowedOverrides() : java.util.Set.of();
            java.util.Map<String, String> safeMap = new java.util.HashMap<>(job.props() != null ? job.props() : java.util.Map.of());
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
    }

}
