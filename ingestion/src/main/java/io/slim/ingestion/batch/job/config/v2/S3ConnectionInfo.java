package io.slim.ingestion.batch.job.config.v2;

import lombok.Data;

@Data
public class S3ConnectionInfo {
    private String endpoint;
    private String region;
}
