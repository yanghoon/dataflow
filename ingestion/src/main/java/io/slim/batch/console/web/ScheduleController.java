package io.slim.batch.console.web;

import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.slim.batch.console.scheduler.JobSchedulerRepository.ScheduleDto;
import io.slim.batch.console.scheduler.JobSchedulerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/batch/schedules")
@ConditionalOnBean(JobSchedulerService.class)
@RequiredArgsConstructor
public class ScheduleController {

    private final JobSchedulerService jobSchedulerService;

    public record ScheduleRequest(String jobName, String cronExpression, Map<String, String> parameters) {}

    @GetMapping
    public ResponseEntity<List<ScheduleDto>> getSchedules() {
        return ResponseEntity.ok(jobSchedulerService.getSchedules());
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> createSchedule(@RequestBody ScheduleRequest request) {
        String id = jobSchedulerService.registerSchedule(request.jobName(), request.cronExpression(), request.parameters());
        return ResponseEntity.ok(Map.of("id", id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateSchedule(@PathVariable("id") String id, @RequestBody ScheduleRequest request) {
        jobSchedulerService.updateSchedule(id, request.jobName(), request.cronExpression(), request.parameters());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelSchedule(@PathVariable("id") String id) {
        jobSchedulerService.cancelSchedule(id);
        return ResponseEntity.ok().build();
    }
}
