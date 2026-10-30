package io.slim.workflow.app.adapter.workflow.csv;

import java.nio.file.Path;

import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import io.slim.workflow.domain.utils.WorkflowPropsBinder;
import lombok.Data;
import lombok.Setter;

@Data
public class CsvExportContext {
    private Rest rest;
    private S3 s3;
    private Postgres postgres;

    @Setter private WorkflowJob job;
    @Setter private Path tempFile;
    @Setter private String s3Key;
    @Setter private long copyCount;

    static CsvExportContext of(WorkflowJob job, WorkflowParams params) {
        var context = WorkflowPropsBinder.bind(job, params, CsvExportContext.class);
        context.setJob(job);
        return context;
    }

    record Rest(String clientId, String path) {}

    record S3(String clientId, String bucket, String keyPattern) {}

    record Postgres(String tableName, String insertSql, String systemId) {}

}