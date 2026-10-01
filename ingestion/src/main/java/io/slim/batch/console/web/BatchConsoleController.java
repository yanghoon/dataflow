package io.slim.batch.console.web;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.launch.JobExecutionAlreadyRunningException;
import org.springframework.batch.core.launch.JobInstanceAlreadyCompleteException;
import org.springframework.batch.core.launch.JobRestartException;
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
public class BatchConsoleController {

    private final JobRegistry jobRegistry;
    private final JobLauncher jobLauncher;

    @GetMapping("/jobs")
    public ResponseEntity<List<String>> getJobNames() {
        return ResponseEntity.ok(jobRegistry.getJobNames().stream().collect(Collectors.toList()));
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
