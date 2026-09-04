package io.slim.workflow.domain;

import java.util.Map;

public interface WorkflowLauncher {
    void launch(String jobName, WorkflowParams params);
    void validate(String jobName, Map<String, String> overrideParams);
}
