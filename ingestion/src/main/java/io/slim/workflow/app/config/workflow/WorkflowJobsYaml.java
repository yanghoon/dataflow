package io.slim.workflow.app.config.workflow;

import io.slim.workflow.domain.WorkflowJobSpec;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

@ConfigurationProperties(prefix = "workflow")
public record WorkflowJobsYaml(Map<String, WorkflowJobSpec> jobs) {}
