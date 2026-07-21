package io.slim.ingestion.batch.job.config.v2;

import org.springframework.context.EnvironmentAware;

import io.slim.ingestion.batch.job.config.core.JobDef;
import io.slim.ingestion.batch.job.config.core.dto.SourceStepConfig;
import io.slim.ingestion.batch.job.config.core.dto.TargetStepConfig;
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
    @Bean
    public JobDef s3ToPostgresImportJobDef() {
        return new S3ToPostgresJobDef(connectionRegistry);
    }

    public static class S3ToPostgresJobDef implements JobDef, EnvironmentAware {
        private Environment env;
        private final ConnectionRegistry connectionRegistry;

        public S3ToPostgresJobDef(ConnectionRegistry connectionRegistry) {
            this.connectionRegistry = connectionRegistry;
        }

        @Override
        public void setEnvironment(Environment environment) {
            this.env = environment;
        }

        @Override
        public String getJobName() {
            return "s3ToPostgresImportJob";
        }

        @Override
        public JobParameters buildParameters(long triggeredAt) {
            // 주의: 이 내부는 '트리거 되는 순간'에 실행되므로 항상 최신 YAML 상태를 읽음

            // 1. Environment(YAML)에서 이 Job에 해당하는 설정 파싱
            String prefix = "jobs.s3-postgres-import";
            SourceStepConfig source = Binder.get(env).bind(prefix + ".source", SourceStepConfig.class).get();
            TargetStepConfig target = Binder.get(env).bind(prefix + ".target", TargetStepConfig.class).get();

            // 2. ConnectionRegistry에서 최신 S3 Region 등 조회
            S3ConnectionInfo s3Conn = connectionRegistry.getS3(source.getConnectionId());

            // 3. Flatten 방식의 JobParameters 생성 (Dot notation)
            return new JobParametersBuilder()
                .addString("s3.bucket", source.getBucket())
                .addString("s3.key", source.getKey())
                .addString("s3.region", s3Conn.getRegion())
                .addString("target.tableName", target.getTableName())
                .addString("target.columns", target.getColumns())
                .addString("target.options", target.getOptions())
                .addString("target.sqlResourcePath", target.getSqlResourcePath())
                .addLong("triggeredAt", triggeredAt) // 유니크 키
                .toJobParameters();
        }
    }
}
