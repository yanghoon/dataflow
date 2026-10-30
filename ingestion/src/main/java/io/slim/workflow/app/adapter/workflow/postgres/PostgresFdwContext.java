package io.slim.workflow.app.adapter.workflow.postgres;

import java.nio.file.Path;

import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import io.slim.workflow.domain.utils.WorkflowPropsBinder;
import lombok.Data;
import lombok.Setter;

@Data
public class PostgresFdwContext {
    private Postgres postgres;

    @Setter private WorkflowJob job;
    @Setter private long copyCount;

    static PostgresFdwContext of(WorkflowJob job, WorkflowParams params) {
        var context = WorkflowPropsBinder.bind(job, params, PostgresFdwContext.class);
        context.setJob(job);
        return context;
    }

    record Postgres(String tableName, String insertSql, String systemId) {}

}