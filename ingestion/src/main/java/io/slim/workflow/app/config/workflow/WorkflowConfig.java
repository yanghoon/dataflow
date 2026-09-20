package io.slim.workflow.app.config.workflow;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.slim.workflow.app.adapter.workflow.csv.CsvExportWorkflow;
import io.slim.workflow.app.adapter.workflow.event.DormantCustomerPolicy;
import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.repo.WorkflowJobRepository;
import io.slim.workflow.domain.repo.WorkflowRepository;

@Configuration
@EnableConfigurationProperties(WorkflowProperties.class)
public class WorkflowConfig {

    @Bean
    WorkflowRepository workflowRepository(List<Workflow> workflows) {
        var data = workflows.stream().collect(Collectors.toMap(Workflow::getType, w -> w));
        return type -> Optional.ofNullable(data.get(type));
    }

    @Bean
    WorkflowJobRepository workflowJobRepository(WorkflowProperties props) {
        return jobName -> Optional.ofNullable(props.jobs().get(jobName));
    }

    @Bean
    Workflow csv(AutowireCapableBeanFactory factory) {
        return factory.createBean(CsvExportWorkflow.class);
    }

    @Bean
    Workflow dormantCustomerPolicy(AutowireCapableBeanFactory factory) {
        return factory.createBean(DormantCustomerPolicy.class);
    }



}
