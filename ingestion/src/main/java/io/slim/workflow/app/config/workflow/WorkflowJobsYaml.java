package io.slim.workflow.app.config.workflow;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

@ConfigurationProperties(prefix = "workflow")
public record WorkflowJobsYaml(Map<String, WorkflowJobProperties> jobs) {}
