package io.slim.ingestion.batch.v2.app.service;

import org.springframework.batch.core.job.parameters.JobParameters;

public interface JobDef {
    String getJobName();
    JobParameters buildParameters(long triggeredAt);
}
