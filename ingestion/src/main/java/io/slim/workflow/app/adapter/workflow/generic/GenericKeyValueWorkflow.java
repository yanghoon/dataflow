package io.slim.workflow.app.adapter.workflow.generic;

import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class GenericKeyValueWorkflow implements Workflow {

    @Getter
    private final String type = "generic";

    @Override
    public void execute(WorkflowJob job, WorkflowParams params) {
        log.info("[GenericKeyValueWorkflow] Executing job: {}", job.name());
        
        if (job.props() != null && !job.props().isEmpty()) {
            log.info("[GenericKeyValueWorkflow] Key-Value parameters provided:");
            job.props().forEach((key, value) -> 
                log.info("  - {} : {}", key, value)
            );
        } else {
            log.info("[GenericKeyValueWorkflow] No Key-Value parameters provided.");
        }
    }

}
