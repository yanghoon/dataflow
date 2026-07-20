package io.slim.ingestion.batch.job.config;

import java.time.Duration;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient.RequestBodySpec;

import io.slim.ingestion.batch.job.step.http.HttpCallback;
import io.slim.ingestion.batch.job.step.http.HttpTasklet;
import io.slim.ingestion.batch.job.step.s3.S3UploadTasklet;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3UploadJobConfig {

    private static final String JOB = "s3-upload-job";
    private static final String SOURCE_STEP = "http-download-trigger-step";
    private static final String TARGET_STEP = "s3-upload-step";

    private HttpCallback httpCallback = new HttpCallback() {
        @Override
        public RepeatStatus call(RequestBodySpec req, ResponseEntity<?> res, ChunkContext context) throws Exception {
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Fail to request: " + res.getStatusCode());
            }

            if (res.getHeaders().getContentLength() == 0) {
                Thread.sleep(Duration.ofSeconds(10).toMillis());
                return RepeatStatus.CONTINUABLE;
            }
            
            return RepeatStatus.FINISHED;
        }
    };

    @Bean @Qualifier(SOURCE_STEP)
    Step httpDownloadTriggerStep(JobRepository jobRepo) {
        return new StepBuilder(SOURCE_STEP, jobRepo)
                .tasklet(new HttpTasklet().setCallback(httpCallback))
                .build();
    }

    @Bean @Qualifier(TARGET_STEP)
    Step s3UploadStep(JobRepository jobRepo, S3Client s3Client) {
        return new StepBuilder(TARGET_STEP, jobRepo)
                    .tasklet(new S3UploadTasklet(s3Client))
                    .build();
    }
    
    @Bean
    Job s3UploadJob(
        JobRepository jobRepo,
        @Qualifier(SOURCE_STEP) Step httpDownloadTriggerStep,
        @Qualifier(TARGET_STEP) Step s3UploadStep
    ) {
        return new JobBuilder(JOB, jobRepo)
                    .start(httpDownloadTriggerStep)
                    .next(s3UploadStep)
                    .build();
    }
}
