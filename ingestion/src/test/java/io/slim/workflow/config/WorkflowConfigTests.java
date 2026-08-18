package io.slim.workflow.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Configuration;

import io.slim.workflow.app.config.workflow.WorkflowProperties;
import io.slim.workflow.config.WorkflowConfigTests.Config;

@SpringBootTest(classes = Config.class)
public class WorkflowConfigTests {

    @Configuration
    @EnableConfigurationProperties(WorkflowProperties.class)
    static class Config {}

    @Autowired
    WorkflowProperties props;

    @Test
    void test_load_workflowjob_properties() {
        assertThat(props).isNotNull();
        assertThat(props.jobs()).isNotNull().isNotEmpty();
        assertThat(props.jobs()).containsKey("customers-csv-ingest-job");
    }

}
