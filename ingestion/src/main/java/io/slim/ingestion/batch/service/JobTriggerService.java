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

    // List<JobDef>를 주입받아 Map으로 변환하여 빠른 검색(O(1)) 지원
    public JobTriggerService(List<JobDef> jobDefs, 
                             JobRegistry springJobRegistry, 
                             JobOperator jobOperator) {
        this.jobDefRegistry = jobDefs.stream()
                .collect(Collectors.toMap(JobDef::getJobName, def -> def));
        this.springJobRegistry = springJobRegistry;
        this.jobOperator = jobOperator;
    }

    public JobExecution triggerNew(String jobName) throws Exception {
        // 1. 잡 이름으로 JobDef 구현체 찾기
        JobDef jobDef = jobDefRegistry.get(jobName);
        if (jobDef == null) {
            throw new IllegalArgumentException("등록되지 않은 JobDef 입니다: " + jobName);
        }

        // 2. 동적으로 파라미터 생성 (이 시점에 최신 YAML과 Registry가 조합됨)
        JobParameters params = jobDef.buildParameters(System.currentTimeMillis());

        // 3. Spring Batch Job 실행
        Job job = springJobRegistry.getJob(jobName);
        log.info("Triggering new job: {} with parameters: {}", jobName, params);
        return jobOperator.start(job, params);
    }
    
    public JobExecution restart(long executionId) throws Exception {
        // 재시작 로직은 기존처럼 실패한 execution의 파라미터를 그대로 재활용
        // (JobDef를 통하지 않음)
        try {
            Long newExecutionId = jobOperator.restart(executionId);
            log.info("Restarted executionId: {} -> newExecutionId: {}", executionId, newExecutionId);
            return null; // Return value adjusted for JobOperator
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to restart execution: " + executionId, e);
        }
    }
}
