package io.slim.workflow.domain;

import java.io.Serializable;
import java.util.Map;

// @Deprecated
public record WorkflowJob(
    String name,
    String group,
    String cron,
    boolean enabled,
    String type,
    Map<String, String> props
) implements Serializable {

    public WorkflowJob withName(String name) {
        return new WorkflowJob(name, group, cron, enabled, type, props);
    }

}
