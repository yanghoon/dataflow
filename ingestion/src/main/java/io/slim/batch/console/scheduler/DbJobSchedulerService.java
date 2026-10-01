package io.slim.batch.console.scheduler;

import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
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
    public void cancelSchedule(String id) {
        repository.delete(id);
    }
}
