package io.slim.workflow.app.adapter.workflow.postgres;

import java.nio.file.Path;

import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import io.slim.workflow.domain.WorkflowJob;
import lombok.Data;
import lombok.Setter;

@Data
public class PostgresFdwContext {
    private Postgres postgres;

    @Setter private WorkflowJob job;
    @Setter private long copyCount;

    static PostgresFdwContext of(WorkflowJob job) {
        var binder = new Binder(new MapConfigurationPropertySource(job.props()));
        var context = binder.bindOrCreate("", PostgresFdwContext.class);
        context.setJob(job);
        return context;
    }

    record Postgres(String tableName, String insertSql, String systemId) {}

}