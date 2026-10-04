package io.slim.workflow.app.config.batch;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.configuration.support.MapJobRegistry;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry;
import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.ConnectionProperties;
import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.DefaultConnectionRegistry;
import io.slim.workflow.app.service.JobTriggerService;

@Configuration
public class BatchConfig {

    @Bean
    JobTriggerService jobTriggerService(AutowireCapableBeanFactory factory) {
        return factory.createBean(JobTriggerService.class);
    }

    @Bean
    JobRegistry jobRegistry() {
        return new MapJobRegistry();
    }

    @Bean
    @ConditionalOnMissingBean
    ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    @Bean
    ConnectionRegistry connectionRegistry(ConnectionProperties props) {
        return new DefaultConnectionRegistry(props);
    }

    @Bean
    @ConfigurationProperties("app.connections")
    ConnectionProperties connectionProperties() {
        return new ConnectionProperties();
    }

}
