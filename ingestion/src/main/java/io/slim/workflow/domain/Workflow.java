package io.slim.workflow.domain;

public interface Workflow {
    WorkflowExecutionResult execute(WorkflowJobSnapshot jobSnapshot, WorkflowParams params);
}
