package io.slim.ingestion.batch.v2.app.config;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.configuration.support.MapJobRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration("batchConfigV2")
public class BatchConfig {

    // @Bean
    // JobTriggerService jobTriggerService(AutowireCapableBeanFactory factory) {
    //     return factory.createBean(JobTriggerService.class);
    // }

    @Bean
    JobRegistry jobRegistry() {
        return new MapJobRegistry();
    }

    // @Bean
    // ConnectionRegistry connectionRegistry(ConnectionProperties props) {
    //     return new DefaultConnectionRegistry(props);
    // }

    // @Bean
    // @ConfigurationProperties("app.connections")
    // ConnectionProperties connectionProperties() {
    //     return new ConnectionProperties();
    // }

}
