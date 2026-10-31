package io.slim.workflow.domain;

public record WorkflowExecutionResult(boolean success, String errorMessage) {}
