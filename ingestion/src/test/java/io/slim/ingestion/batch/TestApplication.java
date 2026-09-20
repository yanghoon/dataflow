package io.slim.ingestion.batch;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import io.slim.ingestion.batch.job.config.v2.S3ToPostgresImportJobConfig;
import io.slim.ingestion.batch.job.step.postgres.PostgresImportS3CsvTasklet;
import io.slim.ingestion.batch.v2.app.service.JobTriggerService;

@Configuration
@EnableAutoConfiguration
// @org.springframework.boot.context.properties.EnableConfigurationProperties(io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.class)
@Import({
    S3ToPostgresImportJobConfig.class,
    JobTriggerService.class,
    PostgresImportS3CsvTasklet.class
})
public class TestApplication {
    public static void main(String[] args) {
        SpringApplication.run(TestApplication.class, args);
    }
    
}
