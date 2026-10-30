package io.slim.workflow.domain.utils;

import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;

public final class WorkflowPropsBinder {

    private WorkflowPropsBinder() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    public static <T> T bind(WorkflowJob job, WorkflowParams params, Class<T> targetType) {
        Map<String, String> mergedProps = new HashMap<>();
        
        if (job.props() != null) {
            mergedProps.putAll(job.props());
        }
        
        if (params != null && params.values() != null) {
            mergedProps.putAll(params.values());
        }

        Binder binder = new Binder(new MapConfigurationPropertySource(mergedProps));
        return binder.bindOrCreate("", targetType);
    }
}
