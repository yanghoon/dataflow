package io.slim.batch.console.scheduler;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public interface JobSchedulerRepository {
    record ScheduleDto(
        String id,
        String jobName,
        String cronExpression,
        Map<String, String> parameters,
        Instant createdAt,
        Instant lastExecutionTime,
        String lastStatus
    ) {}
    void save(String id, String jobName, String cronExpression, Map<String, String> parameters);
    void update(String id, String jobName, String cronExpression, Map<String, String> parameters);
    void delete(String id);
    List<ScheduleDto> findAll();
}
