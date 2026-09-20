package io.slim.ingestion.batch.job.param;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.job.parameters.JobParameter;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import java.util.Map;
import java.util.stream.Collectors;

public class StepParamsBinder {

    private final ObjectMapper mapper = new ObjectMapper();

    public static <T> T bind(JobParameters params, String prefix, Class<T> clazz) {
        var binder = toBinder(params);
        return binder.bind(prefix, clazz).get();
    }

    public static Binder toBinder(JobParameters params) {
        var raw = params.parameters().stream().collect(Collectors.toMap(JobParameter::name, JobParameter::value));
        return new Binder(new MapConfigurationPropertySource(raw));
    }

    public static void appendTo(JobParametersBuilder builder, Map<String, Object> map) {
        map.forEach((k, v) -> {
            if (v == null) return;

            if (v instanceof Long l) {
                builder.addLong(k, l);
            } else {
                builder.addString(k, v.toString());
            }
        });
    }

    public static Map<String, Object> flatten(Object obj, String prefix) {
        // TODO
        return java.util.Collections.emptyMap();
    }

} 