package io.slim.batch.console.scheduler;

import java.util.Map;
import java.util.List;
import io.slim.batch.console.scheduler.JobSchedulerRepository.ScheduleDto;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@ConditionalOnBean(JobSchedulerRepository.class)
@RequiredArgsConstructor
public class DbJobSchedulerService implements JobSchedulerService {

    private final JobSchedulerRepository repository;

    @Override
    public String registerSchedule(String jobName, String cronExpression, Map<String, String> parameters) {
        String id = UUID.randomUUID().toString();
        repository.save(id, jobName, cronExpression, parameters);
        return id;
    }

    @Override
    public List<ScheduleDto> getSchedules() {
        return repository.findAll();
    }

    @Override
    public void updateSchedule(String id, String jobName, String cronExpression, Map<String, String> parameters) {
        repository.update(id, jobName, cronExpression, parameters);
    }

    @Override
    public void cancelSchedule(String id) {
        repository.delete(id);
    }
}
