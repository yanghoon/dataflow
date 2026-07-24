package io.slim.ingestion.batch.infra.rest;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private final JobRegistry jobRegistry;
    private final JobTriggerService triggerService;
    // private final JobOperator jobOperator;

    public JobController(JobRegistry jobRegistry, JobTriggerService triggerService) {
        this.jobRegistry = jobRegistry;
        this.triggerService = triggerService;
    }

    @GetMapping
    public ResponseEntity<Object> getJobInfoList() {
        var jobNames = jobRegistry.getJobNames();
        return ResponseEntity.ok(jobNames);
    }

    @GetMapping("/{jobName}:run")
    public ResponseEntity<JobExecution> runHttpJob(
            @PathVariable("jobName") String jobName,
            @RequestParam Map<String, String> params
        ) throws Exception {
        var job = jobRegistry.getJob(jobName);
        var jobParams = new JobParametersBuilder()
            .addLocalDateTime("startTime", LocalDateTime.now());
        params.forEach(jobParams::addString);

        var res = jobOperator.start(job, jobParams.toJobParameters());
        return ResponseEntity.ok(res);
    }
    
}
