package io.slim.ingestion.batch.job.config.core.dto;

import lombok.Data;

@Data
public class TargetStepConfig {
    private String sqlResource;
    private String tableName;
    private String columns;
    private String options;
    
    public String getSqlResourcePath() {
        return sqlResource;
    }
}
