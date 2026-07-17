package io.slim.ingestion.batch.config;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.configuration.support.MapJobRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class BatchConfig {

    @Bean
    JobRegistry jobRegistry() {
        return new MapJobRegistry();
    }

}
