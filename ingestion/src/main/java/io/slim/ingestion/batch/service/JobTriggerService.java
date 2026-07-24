package io.slim.ingestion.batch.service;


import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.stereotype.Service;

import io.slim.ingestion.batch.job.config.core.JobDef;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class JobTriggerService {

    private final Map<String, JobDef> jobDefRegistry;
    private final JobRegistry springJobRegistry;
    private final JobOperator jobOperator;

    public JobTriggerService(List<JobDef> jobDefs, 
                             JobRegistry springJobRegistry, 
                             JobOperator jobOperator) {
        this.jobDefRegistry = jobDefs.stream()
                .collect(Collectors.toMap(JobDef::getJobName, def -> def));
        this.springJobRegistry = springJobRegistry;
        this.jobOperator = jobOperator;
    }

    public JobExecution triggerNew(String jobName) throws Exception {
        JobDef def = jobDefRegistry.get(jobName);
        Job job = springJobRegistry.getJob(jobName);

        if (def == null) throw new IllegalArgumentException("Not found job def: " + jobName);
        if (job == null) throw new IllegalArgumentException("Not found job: " + jobName);

        JobParameters params = jobDef.buildParameters(System.currentTimeMillis());

        log.info("Triggering new job: {} with parameters: {}", jobName, params);
        return jobOperator.start(job, params);
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
