package io.slim.workflow.app.adapter.rest.batch;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.job.parameters.JobParametersValidator;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.repository.explore.JobExplorer;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.workflow.app.adapter.rest.batch.SchemaAwareValidator;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.media.Schema;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/jobs")
@RequiredArgsConstructor
public class AdminJobController {

    private final JobRegistry jobRegistry;
    private final JobLauncher jobLauncher;
    private final JobExplorer jobExplorer;
    private final ObjectMapper objectMapper;

    @GetMapping("/{jobName}")
    public ResponseEntity<Object> getJobSchema(@PathVariable("jobName") String jobName) throws Exception {
        Job job = jobRegistry.getJob(jobName);
        JobParametersValidator validator = job.getJobParametersValidator();
        if (validator instanceof SchemaAwareValidator<?> schemaAwareValidator) {
            Class<?> targetClass = schemaAwareValidator.getTargetClass();
            Map<String, Schema> schemas = ModelConverters.getInstance().readAll(targetClass);
            if (!schemas.isEmpty()) {
                return ResponseEntity.ok(schemas.values().iterator().next());
            }
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{jobName}/params/validate")
    public ResponseEntity<Object> validateJobParams(
            @PathVariable("jobName") String jobName,
            @RequestBody Map<String, Object> params) throws Exception {
        
        Job job = jobRegistry.getJob(jobName);
        JobParametersValidator validator = job.getJobParametersValidator();
        
        if (validator instanceof SchemaAwareValidator<?> schemaAwareValidator) {
            Class<?> targetClass = schemaAwareValidator.getTargetClass();
            Object dto = objectMapper.convertValue(params, targetClass);
            
            ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
            Validator beanValidator = factory.getValidator();
            
            Set<ConstraintViolation<Object>> violations = beanValidator.validate(dto);
            if (!violations.isEmpty()) {
                var errors = violations.stream().map(v -> Map.of(
                    "field", v.getPropertyPath().toString(),
                    "message", v.getMessage()
                )).collect(Collectors.toList());
                return ResponseEntity.badRequest().body(errors);
            }
        }
        
        return ResponseEntity.ok(Map.of("valid", true));
    }

    @PostMapping("/{jobName}/executions")
    public ResponseEntity<Object> launchJob(
            @PathVariable("jobName") String jobName,
            @RequestBody Map<String, Object> params) throws Exception {
        
        Job job = jobRegistry.getJob(jobName);
        JobParametersBuilder builder = new JobParametersBuilder()
            .addLocalDateTime("startTime", LocalDateTime.now());
        
        params.forEach((key, value) -> {
            if (value != null) {
                builder.addString(key, String.valueOf(value));
            }
        });
        
        JobExecution execution = jobLauncher.run(job, builder.toJobParameters());
        return ResponseEntity.ok(Map.of("executionId", execution.getId()));
    }

    @GetMapping("/{jobName}/executions/{executionId}")
    public ResponseEntity<Object> getJobExecution(
            @PathVariable("jobName") String jobName,
            @PathVariable("executionId") Long executionId) {
        
        JobExecution execution = jobExplorer.getJobExecution(executionId);
        if (execution == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(Map.of(
            "executionId", execution.getId(),
            "status", execution.getStatus().name(),
            "exitStatus", execution.getExitStatus().getExitCode(),
            "startTime", execution.getStartTime(),
            "endTime", execution.getEndTime()
        ));
    }
}
