package io.slim.ingestion.batch.job.param;

public class StepParamsBinder {

    private final ObjectMapper mapper = new ObjectMapper();

    public static <T> Binder bind(JobParameters params, String prefix, Class<T> clazz) {
        var binder = toBinder(params);
        return binder.bind(prefix, claxx).get();
    }

    public static Binder toBinder(JobParameters params) {
        var raw = params.parameters().stream().collect(Collectors.toMap(JobParameter::name, JobParameter::value));
        return new Binder(new MapConfigurationProperySource(raw));
    }

    public static void appendTo(JobParametersBuilder builder, Map<String, Object> map) {
        map.forEach((k, v) -> {
            if (v == null) return;

            if (v instanceof Long l) {
                binder.addLong(k, l);
            } else {
                builder.addString(k, v.toString());
            }
        });
    }

    public static Map<String, Object> flatten(Object obj, String prefix) {
        // TODO
    }

} 