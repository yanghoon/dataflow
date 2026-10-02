package io.slim.batch.console.scheduler;

import java.util.Map;
import java.util.List;

public interface JobSchedulerRepository {
    record ScheduleDto(String id, String jobName, String cronExpression, Map<String, String> parameters) {}
    void save(String id, String jobName, String cronExpression, Map<String, String> parameters);
    void update(String id, String jobName, String cronExpression, Map<String, String> parameters);
    void delete(String id);
    List<ScheduleDto> findAll();
}
