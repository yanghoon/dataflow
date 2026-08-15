package io.slim.workflow.config;

import io.slim.workflow.job.CsvExportS3PgCopyWorkflow;
import io.slim.workflow.job.RemotePgToLocalPgFdwWorkflow;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.client.RestClient;
import software.amazon.awssdk.services.s3.S3Client;

import javax.sql.DataSource;

@Configuration
public class WorkflowJobConfig {

    @Bean("csv-export")
    public CsvExportS3PgCopyWorkflow csvExportS3PgCopyWorkflow(
            RestClient restClient,
            S3Client s3Client,
            DataSource dataSource) {
        return new CsvExportS3PgCopyWorkflow(restClient, s3Client, dataSource);
    }

    @Bean("remote-pg-sync")
    public RemotePgToLocalPgFdwWorkflow remotePgToLocalPgFdwWorkflow(
            NamedParameterJdbcTemplate namedJdbcTemplate) {
        return new RemotePgToLocalPgFdwWorkflow(namedJdbcTemplate);
    }

    @Bean("key-value-workflow")
    public io.slim.workflow.job.GenericKeyValueWorkflow genericKeyValueWorkflow() {
        return new io.slim.workflow.job.GenericKeyValueWorkflow();
    }
}
