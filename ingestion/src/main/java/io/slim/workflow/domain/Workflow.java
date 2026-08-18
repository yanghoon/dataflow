package io.slim.workflow.domain;

public interface Workflow {
    void execute(WorkflowJob jobSnapshot, WorkflowParams params);
}
