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
            WorkflowJob snapshot = jobRepository.findByJobName(jobName).get();
            Workflow workflow = workflowRepository.findByWorkflowType(snapshot.workflowType())
                    .orElseThrow(() -> new IllegalStateException("알 수 없는 workflowType: " + snapshot.workflowType()));

            Exception executionException = null;
            try {
                workflow.execute(snapshot, params);
            } catch (Exception e) {
                executionException = e;
            }
        }
    }

}
