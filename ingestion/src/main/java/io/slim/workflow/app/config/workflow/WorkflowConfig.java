package io.slim.workflow.app.config.workflow;

import java.util.Map;
import java.util.Optional;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.repo.WorkflowJobRepository;
import io.slim.workflow.domain.repo.WorkflowRepository;

@Configuration
@EnableConfigurationProperties(WorkflowProperties.class)
public class WorkflowConfig {

    @Bean
    WorkflowRepository workflowRepository(Map<String, Workflow> workflows) {
        return type -> Optional.ofNullable(workflows.get(type));
    }

    @Bean
    WorkflowJobRepository workflowJobRepository(WorkflowProperties props) {
        return jobName -> Optional.ofNullable(props.jobs().get(jobName));
    }
}
