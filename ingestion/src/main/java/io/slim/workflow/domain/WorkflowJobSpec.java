package io.slim.workflow.domain;

import java.util.Map;

public record WorkflowJobSpec(
    String jobName,
    String group,
    WorkflowJobSnapshot.Engine engine,
    String cronExpression,
    boolean enabled,
    String workflowType,
    String springBatchJobName,
    Map<String, String> where
) {
    public WorkflowJobSnapshot toSnapshot() {
        return new WorkflowJobSnapshot()
            .jobName(jobName).group(group).cronExpression(cronExpression)
            .enabled(enabled).engine(engine).workflowType(workflowType)
            .springBatchJobName(springBatchJobName).where(where);
    }
}
