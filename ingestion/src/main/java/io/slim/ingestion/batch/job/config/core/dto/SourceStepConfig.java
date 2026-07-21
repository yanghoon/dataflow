package io.slim.ingestion.batch.job.config.core.dto;

import lombok.Data;

@Data
public class SourceStepConfig {
    private String connectionId;
    private String bucket;
    private String key;
}
