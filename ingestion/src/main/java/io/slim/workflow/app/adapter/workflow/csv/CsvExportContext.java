package io.slim.workflow.app.adapter.workflow.csv;

import java.nio.file.Path;

import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import io.slim.workflow.domain.WorkflowJob;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;

@Getter
@RequiredArgsConstructor
public class CsvExportContext {
    private final Http http;
    private final S3 s3;
    private final Postgres postgres;

    @Setter private WorkflowJob job;
    @Setter private Path tempFile;
    @Setter private String s3Key;
    @Setter private long copyCount;

    static CsvExportContext of(WorkflowJob job) {
        var binder = new Binder(new MapConfigurationPropertySource(job.props()));
        var context = binder.bind("", CsvExportContext.class).get();
        context.setJob(job);
        return context;
    }

    record Http(String clientId, String path) {}

    record S3(String clientId, String bucket, String keyPattern) {}

    record Postgres(String tableName, String insertSql, String systemId) {}

}