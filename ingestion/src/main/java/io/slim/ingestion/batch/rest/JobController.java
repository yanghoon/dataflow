package io.slim.ingestion.batch.rest;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/jobs")
public class JobController {

    // private final JobLauncher jobLauncher;
    // private final JobLocator jobLocator
    private final JobOperator jobOperator;
    private final Job httpJob;

    public JobController(
        // JobLauncher jobLauncher,
        // JobLocator jobLocator,
        Job httpJob,
        JobOperator jobOperator) {
        // this.jobLauncher = jobLauncher;
        // this.jobLocator = jobLocator;
        this.httpJob = httpJob;
        this.jobOperator = jobOperator;
    }

    @GetMapping("http-job/run")
    public String runHttpJob() throws Exception {
        var params = new JobParametersBuilder()
                .addString("apiUrl", "http://localhost:9090/api/test")
                .addString("httpMethod", "GET")
                .toJobParameters();
        // var job = jobRegistry.getJob("http-job");
        // var job = jobLocator.getJob("http-job");
        // var res = jobLauncher.run(job, params);
        // var res = jobOperator.start("http-job", params.toString());
        var res = jobOperator.start(httpJob, params);
        return "Job started with ID: " + res;
    }
    
}
