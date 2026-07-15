package io.slim.ingestion.batch.config;


import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.slim.ingestion.batch.step.HttpTasklet;

@Configuration
public class HttpJobConfig {

    @Bean
    @Qualifier("httpStep")
    Step httpStep(JobRepository jobRepository) {
        return new StepBuilder("httpStep", jobRepository)
                .tasklet(new HttpTasklet())
                .build();
    }
    
    @Bean
    Job httpJob(JobRepository jobRepository, @Qualifier("httpStep") Step httpStep) {
        return new JobBuilder("httpJob", jobRepository)
                .start(httpStep)
                .build();
    }

}
