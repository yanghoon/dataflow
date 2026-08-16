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

        Exception executionException = null;
        WorkflowExecutionResult result;
        try {
            result = workflow.execute(snapshot, params);
        } catch (Exception e) {
            executionException = e;
            result = new WorkflowExecutionResult(false, e.getMessage());
        }

        WorkflowExecution execution = new WorkflowExecution(
            null, snapshot.jobName(),
            result.success() ? "SUCCESS" : "FAILED",
            start, Instant.now(), result.errorMessage(),
            params.toString(), null
        );
        WorkflowExecution saved = execRepo.save(execution);

        if (executionException != null) {
            throw new RuntimeException("워크플로우 실행 실패. 재시도를 위해 에러를 전파합니다: " + snapshot.jobName(), executionException);
        }
        return saved;
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
