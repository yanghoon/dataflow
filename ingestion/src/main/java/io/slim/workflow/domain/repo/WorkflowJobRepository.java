package io.slim.workflow.domain.repo;

import java.util.Optional;

import io.slim.workflow.domain.WorkflowJob;

public interface WorkflowJobRepository {
    Optional<WorkflowJob> findByJobName(String jobName);
    // void save(WorkflowJobProperties properties);
}
