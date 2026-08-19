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

            try {
                workflow.execute(job, params);
            } catch (Exception e) {
                throw e;
            }
        }
    }

}
