package io.slim.workflow.app.adapter.workflow.csv;

import java.nio.file.Path;

import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import java.util.Map;
import java.util.HashMap;
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
        Map<String, String> mergedProps = new HashMap<>();
        if (job.props() != null) {
            mergedProps.putAll(job.props());
        }
        if (params != null && params.values() != null) {
            mergedProps.putAll(params.values());
        }

        var binder = new Binder(new MapConfigurationPropertySource(mergedProps));
        var context = binder.bindOrCreate("", CsvExportContext.class);
        context.setJob(job);
        return context;
    }

    record Rest(String clientId, String path) {}

    record S3(String clientId, String bucket, String keyPattern) {}

    record Postgres(String tableName, String insertSql, String systemId) {}

}