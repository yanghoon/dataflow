package io.slim.workflow.app.adapter.workflow.generic;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;

public class GenericKeyValueWorkflow implements Workflow {
    private static final Logger log = LoggerFactory.getLogger(GenericKeyValueWorkflow.class);

    @Override
    public void execute(WorkflowJob jobSnapshot, WorkflowParams params) {
        log.info("[GenericKeyValueWorkflow] Executing job: {}", jobSnapshot.jobName());
        
        if (jobSnapshot.props() != null && !jobSnapshot.props().isEmpty()) {
            log.info("[GenericKeyValueWorkflow] Key-Value parameters provided:");
            jobSnapshot.props().forEach((key, value) -> 
                log.info("  - {} : {}", key, value)
            );
        } else {
            log.info("[GenericKeyValueWorkflow] No Key-Value parameters provided.");
        }

        // 이곳에 Key-Value(where 맵) 기반의 동적 로직을 추가하실 수 있습니다.
        
        // return new WorkflowExecutionResult(true, "Successfully executed Key-Value based workflow");
    }
}
