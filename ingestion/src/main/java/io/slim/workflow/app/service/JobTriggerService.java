package io.slim.workflow.app.service;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class JobTriggerService {

    private final JobRegistry springJobRegistry;
    private final JobOperator jobOperator;
    private final org.springframework.batch.core.launch.JobLauncher jobLauncher;

    public JobTriggerService(JobRegistry springJobRegistry, 
                             JobOperator jobOperator,
                             org.springframework.batch.core.launch.JobLauncher jobLauncher) {
        this.springJobRegistry = springJobRegistry;
        this.jobOperator = jobOperator;
        this.jobLauncher = jobLauncher;
    }

    public JobExecution triggerNew(String jobName) throws Exception {
        Job job = springJobRegistry.getJob(jobName);

        if (job == null) throw new IllegalArgumentException("Not found job: " + jobName);

        JobParameters params = new JobParametersBuilder()
                .addLong("triggeredAt", System.currentTimeMillis())
                .toJobParameters();

        log.info("Triggering new job: {} with parameters: {}", jobName, params);
        return jobLauncher.run(job, params);
    }
    
    public JobExecution restart(long executionId) throws Exception {
        try {
            Long newExecutionId = jobOperator.restart(executionId);
            log.info("Restarted executionId: {} -> newExecutionId: {}", executionId, newExecutionId);
            return null; // Return value adjusted for JobOperator
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to restart execution: " + executionId, e);
        }
    }
}
