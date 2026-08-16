package io.slim.workflow.app.config.workflow;

import io.slim.workflow.domain.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.ListableBeanFactory;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Configuration
public class WorkflowConfig {

    private final ListableBeanFactory beanFactory;

    public WorkflowConfig(ListableBeanFactory beanFactory) {
        this.beanFactory = beanFactory;
    }

    @Bean
    public WorkflowRepository workflowRepository() {
        return new WorkflowRepository() {
            private ConcurrentMap<String, Workflow> cache = null;

            @Override
            public Optional<Workflow> findByWorkflowType(String workflowType) {
                if (cache == null) {
                    Map<String, Workflow> beans = beanFactory.getBeansOfType(Workflow.class);
                    cache = new ConcurrentHashMap<>(beans);
                }
                return Optional.ofNullable(cache.get(workflowType));
            }
        };
    }

    @Bean
    public WorkflowJobRepository workflowJobRepository() {
        return new WorkflowJobRepository() {
            private final ConcurrentMap<String, WorkflowJobProperties> store = new ConcurrentHashMap<>();

            @Override
            public Optional<WorkflowJobProperties> findByJobName(String jobName) {
                return Optional.ofNullable(store.get(jobName));
            }

            @Override
            public void save(WorkflowJobProperties properties) {
                store.put(properties.jobName(), properties);
            }
        };
    }
}
