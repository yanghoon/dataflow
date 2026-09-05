package io.slim.ingestion.batch.job.config.v2;

import org.springframework.context.EnvironmentAware;

import io.slim.ingestion.batch.v2.app.service.JobDef;
import org.springframework.stereotype.Component;
import io.slim.ingestion.batch.job.step.postgres.PostgresImportS3CsvTasklet;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
@RequiredArgsConstructor
public class S3ToPostgresImportJobConfig {

    private final static String JOB = "s3-upload-job";
    private final static String STEP_HTTP = "http-polling-step";
    private final static String STEP_S3 = "s3-upload-step";
    private final static String STEP_POSTGRES = "postgres-import-step";

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final PostgresImportS3CsvTasklet tasklet;
    private final ConnectionRegistry connectionRegistry;

    // 1. 실제 Batch Job 조립 (애플리케이션 기동 시 1회 실행)
    @Bean
    public Step s3ToPostgresImportStep() {
        return new StepBuilder("s3ToPostgresImportStep", jobRepository)
            .tasklet(tasklet, transactionManager)
            .build();
    }

    @Bean
    public Job s3ToPostgresImportJob() {
        return new JobBuilder("s3ToPostgresImportJob", jobRepository)
            .start(s3ToPostgresImportStep())
            .build();
    }

    // 2. [NEW] 해당 잡을 위한 파라미터 생성기 (트리거 시점에 실행될 로직)
    // @Bean
    // public JobDef s3ToPostgresImportJobDef() {
    //     return new S3ToPostgresJobDef(connectionRegistry);
    // }

    @Component
    @RequiredArgsConstructor
    public static class S3ToPostgresJobDef implements JobDef {
        private Environment env;
        private final ConnectionRegistry conns;

        @Override
        public String getJobName() {
            return "s3ToPostgresImportJob";
        }

        @Override
        public JobParameters buildParameters(long triggeredAt) {
            // TODO: Implement parameter building logic properly once S3UploadSpec is defined
            return new JobParametersBuilder()
                    .addLong("triggeredAt", triggeredAt)
                    .toJobParameters();
        }
    }
}
