package io.slim.ingestion.batch.job.config.core;

import org.springframework.batch.core.job.parameters.JobParameters;

public interface JobDef {
    String getJobName();
    JobParameters buildParameters(long triggeredAt);
}
