package io.slim.workflow.domain;

public interface Workflow {
    String getType();
    void execute(WorkflowJob jobSnapshot, WorkflowParams params);
    void validate(WorkflowJob jobSnapshot, WorkflowParams overrideParams);
}
