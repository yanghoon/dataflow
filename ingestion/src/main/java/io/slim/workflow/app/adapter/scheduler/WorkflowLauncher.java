package io.slim.workflow.app.adapter.scheduler;

import io.slim.workflow.domain.*;
import java.time.Instant;
import java.util.Map;

public interface WorkflowLauncher {
    WorkflowExecution launch(WorkflowJobSnapshot snapshot, WorkflowParams params);
}

@org.springframework.stereotype.Component
class WorkflowLauncherImpl implements WorkflowLauncher {
    private final org.springframework.beans.factory.BeanFactory beanFactory;

    WorkflowLauncherImpl(org.springframework.beans.factory.BeanFactory beanFactory) {
        this.beanFactory = beanFactory;
    }

    @Override
    public WorkflowExecution launch(WorkflowJobSnapshot snapshot, WorkflowParams params) {
        WorkflowRepository workflowRepository = beanFactory.getBean(WorkflowRepository.class);
        WorkflowExecutionRepository execRepo = beanFactory.getBean(WorkflowExecutionRepository.class);

        Instant start = Instant.now();
        Workflow workflow = workflowRepository.findByWorkflowType(snapshot.workflowType())
                .orElseThrow(() -> new IllegalStateException("알 수 없는 workflowType: " + snapshot.workflowType()));

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
