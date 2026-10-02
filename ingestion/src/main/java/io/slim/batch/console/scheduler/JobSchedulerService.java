package io.slim.batch.console.scheduler;

import java.util.Map;
import java.util.List;
import io.slim.batch.console.scheduler.JobSchedulerRepository.ScheduleDto;

public interface JobSchedulerService {
    String registerSchedule(String jobName, String cronExpression, Map<String, String> parameters);
    void updateSchedule(String id, String jobName, String cronExpression, Map<String, String> parameters);
    void cancelSchedule(String id);
    List<ScheduleDto> getSchedules();
}
