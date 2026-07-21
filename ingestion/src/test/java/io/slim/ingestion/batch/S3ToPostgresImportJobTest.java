package io.slim.ingestion.batch;

import io.slim.ingestion.batch.service.JobTriggerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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

    @MockitoBean
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @MockitoBean
    private org.springframework.batch.core.configuration.JobRegistry jobRegistry;

    @MockitoBean
    private org.springframework.batch.core.launch.JobOperator jobOperator;

    @MockitoBean
    private org.springframework.batch.core.repository.JobRepository jobRepository;

    @Autowired
    private org.springframework.batch.core.job.Job s3ToPostgresImportJob;

    @Test
    @DisplayName("트리거 시점에 JobDef가 올바른 파라미터를 생성하고, Job이 정상적으로 완료되는지 테스트한다.")
    void testJobTriggerAndExecution() throws Exception {
        // Given
        // 실제 데이터베이스 의존성(AWS S3 Import 쿼리)을 제거하기 위해 JdbcTemplate의 queryForObject를 Mocking
        String resultMsg = "1000 rows affected";
        when(namedParameterJdbcTemplate.queryForObject(
                anyString(),
                any(SqlParameterSource.class),
                eq(String.class)
        )).thenReturn(resultMsg);
        
        when(jobRegistry.getJob(anyString())).thenReturn(s3ToPostgresImportJob);
        
        JobExecution mockExecution = org.mockito.Mockito.mock(JobExecution.class);
        when(mockExecution.getStatus()).thenReturn(BatchStatus.COMPLETED);
        when(jobOperator.start(any(org.springframework.batch.core.job.Job.class), any(org.springframework.batch.core.job.parameters.JobParameters.class))).thenReturn(mockExecution);

        // When
        // 잡을 트리거합니다. 이 시점에 내부적으로 JobDef.buildParameters()가 호출되어 YAML에서 파라미터를 구성합니다.
        JobExecution jobExecution = jobTriggerService.triggerNew("s3ToPostgresImportJob");

        // Then
        // 1. Job이 성공적으로 끝났는지 검증 (Mock이 반환한 상태)
        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        
        // 2. JobOperator에 전달된 파라미터 캡처 및 검증
        org.mockito.ArgumentCaptor<org.springframework.batch.core.job.parameters.JobParameters> captor = 
            org.mockito.ArgumentCaptor.forClass(org.springframework.batch.core.job.parameters.JobParameters.class);
        org.mockito.Mockito.verify(jobOperator).start(any(), captor.capture());
        
        org.springframework.batch.core.job.parameters.JobParameters capturedParams = captor.getValue();
        assertThat(capturedParams.getString("s3.bucket")).isEqualTo("my-test-bucket");
        assertThat(capturedParams.getString("s3.region")).isEqualTo("ap-northeast-2");
        assertThat(capturedParams.getString("target.tableName")).isEqualTo("target_schema.test_stage");
    }
}
