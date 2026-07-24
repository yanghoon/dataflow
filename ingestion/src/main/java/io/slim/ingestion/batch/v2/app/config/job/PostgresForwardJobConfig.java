package io.slim.ingestion.batch.v2.app.config.job;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import io.slim.ingestion.batch.v2.app.config.job.CsvIngestJobConfig.CsvIngestJobProps;

@Configuration
@EnableConfigurationProperties(CsvIngestJobProps.class)
public class PostgresForwardJobConfig {

    // TODO: Create Job from JobSpec
    
    @ConfigurationProperties("jobs")
    public record PostgresForwardJobProps(
        List<PostgresForwardJobConfig> postgres
    ) {}

}
