package io.slim.workflow.domain.repo;

import java.util.Optional;

import io.slim.workflow.domain.Workflow;

public interface WorkflowRepository {
    Optional<Workflow> findByWorkflowType(String workflowType);
}
