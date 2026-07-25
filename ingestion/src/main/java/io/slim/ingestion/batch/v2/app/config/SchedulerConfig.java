package io.slim.ingestion.batch.v2.app.config;

import java.time.LocalDateTime;
import java.util.List;

import org.jobrunr.scheduling.JobScheduler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * 
 * @see: https://www.jobrunr.io/en/documentation/getting-started/spring/
 */
@Configuration
@EnableConfigurationProperties(SchedulerConfig.JobScheduleProps.class)
public class SchedulerConfig {

    private static final Logger log = LoggerFactory.getLogger(SchedulerConfig.class);

    @Bean
    public ApplicationRunner initJobRunr(JobScheduler jobScheduler, JobScheduleProps props, BatchJobRunner batchJobRunner) {
        return args -> {
            jobScheduler.enqueue(() -> log.info("JobRunr keepalive task executed"));

            if (props.schedules() != null) {
                for (JobScheduleProps.ScheduleSpec spec : props.schedules()) {
                    jobScheduler.scheduleRecurrently(spec.recurringName(), spec.cron(), () -> batchJobRunner.execute(spec.name()));
                }
            }
        };
    }

    @Component
    @RequiredArgsConstructor
    public static class BatchJobRunner {
        private final JobRegistry jobRegistry;
        private final JobOperator jobLauncher;

        public void execute(String jobName) {
            log.info("Starting scheduled batch job: {}", jobName);
            try {
                var job = jobRegistry.getJob(jobName);
                var params = new JobParametersBuilder()
                    .addString("startTime", LocalDateTime.now().toString())
                    .toJobParameters();
                jobLauncher.start(job, params);
                log.info("Successfully started scheduled batch job: {}", jobName);
            } catch (Exception e) {
                log.error("Failed to start scheduled batch job: {}", jobName, e);
                throw new RuntimeException("Failed to start batch job", e);
            }
        }
    }

    @ConfigurationProperties("jobs")
    public record JobScheduleProps(
        List<ScheduleSpec> schedules
    ) {
        public record ScheduleSpec(
            String name,
            String cron
        ) {
            String taskName() { return "task-" + name; }            
            String recurringName() { return "run-" + name; }            
        }
    }
}
