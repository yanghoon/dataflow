package io.slim.workflow.domain;

public interface Workflow {
    String getType();
    void execute(WorkflowJob jobSnapshot, WorkflowParams params);
}
