package io.slim.workflow.app.config.workflow;

import io.slim.workflow.domain.WorkflowJobSnapshot;

import java.util.Map;

public record WorkflowJobProperties(
    String jobName,
    String group,
    WorkflowJobSnapshot.Engine engine,
    String cronExpression,
    boolean enabled,
    String workflowType,
    String springBatchJobName,
    Map<String, String> where,
    String description
) {
    public WorkflowJobSnapshot toSnapshot() {
        return new WorkflowJobSnapshot()
            .jobName(jobName).group(group).cronExpression(cronExpression)
            .enabled(enabled).engine(engine).workflowType(workflowType)
            .springBatchJobName(springBatchJobName).where(where);
    }
}
