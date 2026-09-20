package io.slim.ingestion.batch.config;

import java.beans.BeanProperty;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.configuration.support.MapJobRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import io.slim.ingestion.batch.v2.app.service.JobTriggerService;
import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry;
import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.ConnectionProperties;
import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.DefaultConnectionRegistry;
import org.springframework.boot.context.properties.ConfigurationProperties;

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
    ConnectionRegistry connectionRegistry(ConnectionProperties props) {
        return new DefaultConnectionRegistry(props);
    }

    @Bean
    @ConfigurationProperties("app.connections")
    ConnectionProperties connectionProperties() {
        return new ConnectionProperties();
    }

}
