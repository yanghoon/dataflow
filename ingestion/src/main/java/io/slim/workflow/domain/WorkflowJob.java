package io.slim.workflow.domain;

import java.io.Serializable;
import java.util.Map;

// @Deprecated
public record WorkflowJob(
    String jobName,
    String group,
    String cron,
    boolean enabled,
    String workflowType,
    // String springBatchJobName,
    Map<String, String> props
) implements Serializable {
    public WorkflowJob withJobName(String jobName) {
        return new WorkflowJob(jobName, group, cron, enabled, workflowType, props);
    }

    // public WorkflowJobSnapshot toSnapshot() {
    //     return new WorkflowJobSnapshot()
    //         .jobName(jobName).group(group).cronExpression(cronExpression)
    //         .enabled(enabled).engine(engine).workflowType(workflowType)
    //         .springBatchJobName(springBatchJobName).where(where);
    // }
}
