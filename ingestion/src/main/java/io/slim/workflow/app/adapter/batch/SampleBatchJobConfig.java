package io.slim.workflow.app.adapter.batch;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Configuration
public class SampleBatchJobConfig {

    @Bean
    public Tasklet sampleTasklet() {
        return (contribution, chunkContext) -> {
            log.info("Hello from SampleBatchJob!");
            return RepeatStatus.FINISHED;
        };
    }

    @Bean
    public Step sampleStep(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
        return new StepBuilder("sampleStep", jobRepository)
                .tasklet(sampleTasklet(), transactionManager)
                .build();
    }

    @Bean
    public Job sampleJob(JobRepository jobRepository, Step sampleStep) {
        return new JobBuilder("sampleJob", jobRepository)
                .start(sampleStep)
                .build();
    }
}
