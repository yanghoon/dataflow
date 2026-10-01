package io.slim.batch.console.scheduler;

import java.util.Map;

public interface JobSchedulerRepository {
    void save(String id, String jobName, String cronExpression, Map<String, String> parameters);
    void delete(String id);
}
