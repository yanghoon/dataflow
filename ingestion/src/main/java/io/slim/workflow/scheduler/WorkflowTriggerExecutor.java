package io.slim.workflow.scheduler;

import io.slim.workflow.domain.*;
import io.slim.workflow.launcher.WorkflowLauncher;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.stereotype.Component;

@Component
public class WorkflowTriggerExecutor {
    private static final org.slf4j.Logger log =
        org.slf4j.LoggerFactory.getLogger(WorkflowTriggerExecutor.class);

    private final WorkflowLauncher workflowLauncher;
    private final JobOperator jobOperator;      // Spring Batch 6: JobLauncher 겸용
    private final JobRegistry jobRegistry;       // v6: 컨텍스트에서 자동 등록됨

    public WorkflowTriggerExecutor(WorkflowLauncher workflowLauncher,
                                   JobOperator jobOperator,
                                   JobRegistry jobRegistry) {
        this.workflowLauncher = workflowLauncher;
        this.jobOperator = jobOperator;
        this.jobRegistry = jobRegistry;
    }

    public WorkflowScheduleData run(String jobName, WorkflowScheduleData data) {
        WorkflowJobSnapshot snapshot = data.content();
        if (!snapshot.enabled()) {
            log.info("[EXEC-SKIP] jobName={} enabled=false", jobName);
            return data;
        }

        switch (snapshot.engine()) {
            case WORKFLOW -> workflowLauncher.launch(snapshot, WorkflowParams.empty());
            case SPRING_BATCH -> {
                try {
                    var job = jobRegistry.getJob(snapshot.springBatchJobName());
                    jobOperator.start(job.getName(), buildJobProperties(snapshot));
                } catch (Exception e) {
                    log.error("[EXEC-BATCH-FAIL] jobName={}", jobName, e);
                    throw new WorkflowExecutionException(jobName, e);
                }
            }
        }
        return data;
    }

    private java.util.Properties buildJobProperties(WorkflowJobSnapshot snapshot) {
        var props = new java.util.Properties();
        if (snapshot.where().get("endpoint") != null) props.setProperty("endpoint", snapshot.where().get("endpoint"));
        if (snapshot.where().get("targetTable") != null) props.setProperty("targetTable", snapshot.where().get("targetTable"));
        props.setProperty("triggerTime", String.valueOf(System.currentTimeMillis()));
        if (snapshot.where().containsKey("pageSize")) {
            props.setProperty("pageSize", snapshot.where().get("pageSize"));
        }
        return props;
    }
}

class WorkflowExecutionException extends RuntimeException {
    WorkflowExecutionException(String jobName, Throwable cause) {
        super("워크플로우 실행 실패: " + jobName, cause);
    }
}
