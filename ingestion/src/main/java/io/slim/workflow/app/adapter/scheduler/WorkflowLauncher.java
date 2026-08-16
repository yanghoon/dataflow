package io.slim.workflow.app.adapter.scheduler;

import io.slim.workflow.domain.*;
import java.time.Instant;
import java.util.Map;

public interface WorkflowLauncher {
    WorkflowExecution launch(WorkflowJobSnapshot snapshot, WorkflowParams params);
}

@org.springframework.stereotype.Component
class WorkflowLauncherImpl implements WorkflowLauncher {
    private final Map<String, Workflow> workflowsByType; // workflowType -> Bean, Spring이 주입
    private final WorkflowExecutionRepository execRepo;

    WorkflowLauncherImpl(Map<String, Workflow> workflowsByType, WorkflowExecutionRepository execRepo) {
        this.workflowsByType = workflowsByType;
        this.execRepo = execRepo;
    }

    @Override
    public WorkflowExecution launch(WorkflowJobSnapshot snapshot, WorkflowParams params) {
        Instant start = Instant.now();
        Workflow workflow = workflowsByType.get(snapshot.workflowType());
        if (workflow == null) {
            throw new IllegalStateException("알 수 없는 workflowType: " + snapshot.workflowType());
        }

        WorkflowExecutionResult result;
        try {
            result = workflow.execute(snapshot, params);
        } catch (Exception e) {
            result = new WorkflowExecutionResult(false, e.getMessage());
        }

        WorkflowExecution execution = new WorkflowExecution(
            null, snapshot.jobName(),
            result.success() ? "SUCCESS" : "FAILED",
            start, Instant.now(), result.errorMessage(),
            params.toString(), null
        );
        return execRepo.save(execution);
    }
}

interface WorkflowExecutionRepository {
    WorkflowExecution save(WorkflowExecution execution);
}

@org.springframework.stereotype.Repository
class DummyWorkflowExecutionRepository implements WorkflowExecutionRepository {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(DummyWorkflowExecutionRepository.class);
    
    @Override
    public WorkflowExecution save(WorkflowExecution execution) {
        log.info("Saving execution: {}", execution);
        return execution;
    }
}
