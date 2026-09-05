package io.slim.workflow.domain;

import java.util.Map;

public record WorkflowParams(Map<String, String> values) {
    public static WorkflowParams empty() {
        return new WorkflowParams(Map.of());
    }
    public String get(String key) {
        return values.get(key);
    }
}
