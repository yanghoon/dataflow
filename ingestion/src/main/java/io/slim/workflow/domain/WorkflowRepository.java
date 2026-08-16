package io.slim.workflow.domain;

import java.util.Optional;

public interface WorkflowRepository {
    Optional<Workflow> findByWorkflowType(String workflowType);
}
