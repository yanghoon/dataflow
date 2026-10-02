package io.slim.batch.console.web;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.JobInstance;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.launch.JobExecutionAlreadyRunningException;
import org.springframework.batch.core.launch.JobInstanceAlreadyCompleteException;
import org.springframework.batch.core.launch.JobRestartException;
import org.springframework.batch.core.repository.explore.JobExplorer;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.slim.batch.console.validation.SchemaAwareValidator;
import io.swagger.v3.oas.models.media.Schema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/batch")
@RequiredArgsConstructor
@SuppressWarnings({"removal", "deprecation"})
public class BatchConsoleController {

    public record BatchJobDto(
        String name,
        boolean restartable,
        boolean hasSchema,
        int totalExecutions,
        String lastStatus,
        Instant lastExecutionTime
    ) {}

    private final JobRegistry jobRegistry;
    private final JobLauncher jobLauncher;
    private final JobExplorer jobExplorer;

    @GetMapping("/jobs")
    public ResponseEntity<List<BatchJobDto>> getJobs() {
        List<BatchJobDto> result = new ArrayList<>();
        List<String> jobNames = jobRegistry.getJobNames().stream().sorted().toList();
        for (String name : jobNames) {
            boolean restartable = false;
            boolean hasSchema = false;
            try {
                Job job = jobRegistry.getJob(name);
                if (job != null) {
                    restartable = job.isRestartable();
                    if (job.getJobParametersValidator() instanceof SchemaAwareValidator<?> validator) {
                        hasSchema = validator.getSchema() != null;
                    }
                }
            } catch (Exception e) {
                log.debug("Job {} not found in registry", name, e);
            }

            int totalExecutions = 0;
            String lastStatus = null;
            Instant lastExecutionTime = null;

            try {
                totalExecutions = (int) jobExplorer.getJobInstanceCount(name);
                JobInstance lastInstance = jobExplorer.getLastJobInstance(name);
                if (lastInstance != null) {
                    JobExecution lastExecution = jobExplorer.getLastJobExecution(lastInstance);
                    if (lastExecution != null) {
                        if (lastExecution.getStatus() != null) {
                            lastStatus = lastExecution.getStatus().name();
                        }
                        LocalDateTime time = lastExecution.getStartTime() != null
                            ? lastExecution.getStartTime()
                            : lastExecution.getCreateTime();
                        if (time != null) {
                            lastExecutionTime = time.atZone(ZoneId.systemDefault()).toInstant();
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("Job {} not found in explorer", name, e);
            }

            result.add(new BatchJobDto(
                name,
                restartable,
                hasSchema,
                totalExecutions,
                lastStatus,
                lastExecutionTime
            ));
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/jobs/{jobName}/schema")
    public ResponseEntity<Schema<?>> getJobSchema(@PathVariable("jobName") String jobName) throws Exception {
        Job job = jobRegistry.getJob(jobName);
        if (job.getJobParametersValidator() instanceof SchemaAwareValidator<?> validator) {
            Schema<?> schema = validator.getSchema();
            if (schema != null) {
                return ResponseEntity.ok(schema);
            }
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/jobs/{jobName}/executions")
    public ResponseEntity<Map<String, Object>> launchJob(
            @PathVariable("jobName") String jobName,
            @RequestBody(required = false) Map<String, Object> params) throws Exception {
        
        Job job = jobRegistry.getJob(jobName);
        JobParametersBuilder builder = new JobParametersBuilder();
        
        // Add start time internally
        builder.addLocalDateTime("startTime", LocalDateTime.now());
        
        if (params != null) {
            params.forEach((key, value) -> {
                if (value != null) {
                    builder.addString(key, String.valueOf(value));
                }
            });
        }
        
        JobExecution execution = jobLauncher.run(job, builder.toJobParameters());
        return ResponseEntity.ok(Map.of("executionId", execution.getId()));
    }

    @ExceptionHandler({JobExecutionAlreadyRunningException.class, JobInstanceAlreadyCompleteException.class})
    public ResponseEntity<Map<String, String>> handleConflictExceptions(Exception e) {
        log.warn("Job execution conflict: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }
    
    @ExceptionHandler(JobRestartException.class)
    public ResponseEntity<Map<String, String>> handleRestartException(Exception e) {
        log.warn("Job restart error: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }
}
