package io.slim.workflow.domain;

import io.slim.workflow.app.config.workflow.WorkflowJobProperties;
import java.util.Optional;

public interface WorkflowJobRepository {
    Optional<WorkflowJobProperties> findByJobName(String jobName);
    void save(WorkflowJobProperties properties);
}
