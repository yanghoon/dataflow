package io.slim.batch.console.scheduler;

import java.util.Map;

public interface JobSchedulerService {
    String registerSchedule(String jobName, String cronExpression, Map<String, String> parameters);
    void cancelSchedule(String id);
}
