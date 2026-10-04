package io.slim.ingestion.batch;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import io.slim.workflow.app.service.JobTriggerService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(classes = TestApplication.class)
@TestPropertySource(properties = {
    "connection-registry.s3.primary.endpoint=s3.ap-northeast-2.amazonaws.com",
    "connection-registry.s3.primary.region=ap-northeast-2",
    "jobs.s3-postgres-import.source.connectionId=primary",
    "jobs.s3-postgres-import.source.bucket=my-test-bucket",
    "jobs.s3-postgres-import.source.key=raw/test/data.csv",
    "jobs.s3-postgres-import.target.sqlResource=classpath:sql/aws_s3_import.sql",
    "jobs.s3-postgres-import.target.tableName=target_schema.test_stage",
    "jobs.s3-postgres-import.target.columns=id, name",
    "jobs.s3-postgres-import.target.options=FORMAT CSV"
})
class S3ToPostgresImportJobTest {

    @Autowired
    private JobTriggerService jobTriggerService;

    @MockitoBean(name = "namedParameterJdbcTemplate")
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @MockitoBean(name = "jobRegistry")
    private JobRegistry jobRegistry;

    @MockitoBean(name = "jobOperator")
    private JobOperator jobOperator;

    @MockitoBean(name = "jobLauncher")
    private JobLauncher jobLauncher;

    @MockitoBean(name = "jobRepository")
    private JobRepository jobRepository;

    @Autowired
    private Job s3ToPostgresImportJob;

    @Test
    @DisplayName("트리거 시점에 Job이 정상적으로 호출되고 완료 상태를 반환하는지 테스트한다.")
    void testJobTriggerAndExecution() throws Exception {
        // Given
        String resultMsg = "1000 rows affected";
        when(namedParameterJdbcTemplate.queryForObject(
                anyString(),
                any(SqlParameterSource.class),
                eq(String.class)
        )).thenReturn(resultMsg);
        
        when(jobRegistry.getJob(anyString())).thenReturn(s3ToPostgresImportJob);
        
        JobExecution mockExecution = mock(JobExecution.class);
        when(mockExecution.getStatus()).thenReturn(BatchStatus.COMPLETED);
        when(jobLauncher.run(any(Job.class), any(JobParameters.class))).thenReturn(mockExecution);

        // When
        JobExecution jobExecution = jobTriggerService.triggerNew("s3ToPostgresImportJob");

        // Then
        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        
        ArgumentCaptor<JobParameters> captor = ArgumentCaptor.forClass(JobParameters.class);
        verify(jobLauncher).run(any(Job.class), captor.capture());
        
        JobParameters capturedParams = captor.getValue();
        assertThat(capturedParams.getLong("triggeredAt")).isNotNull();
    }
}
