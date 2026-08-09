package io.slim.workflow.batch;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.context.annotation.*;

import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class CatalogBatchConfig {

    @Bean
    public Job catalogPagingJob(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
        return new JobBuilder("catalogPagingJob", jobRepository)
            .start(new StepBuilder("dummyStep", jobRepository)
                .tasklet((contribution, chunkContext) -> null, transactionManager)
                .build())
            .build();
    }
}
