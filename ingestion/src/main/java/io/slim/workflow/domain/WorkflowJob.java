package io.slim.workflow.domain;

import java.io.Serializable;
import java.util.Map;

import java.util.Set;

// @Deprecated
public record WorkflowJob(
    String name,
    String group,
    String cron,
    boolean enabled,
    String type,
    Map<String, String> props,
    Set<String> allowedOverrides
) implements Serializable {

    public WorkflowJob withName(String name) {
        return new WorkflowJob(name, group, cron, enabled, type, props, allowedOverrides);
    }

}
