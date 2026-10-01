package io.slim.batch.console.web;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.slim.batch.console.scheduler.JobSchedulerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/batch/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final JobSchedulerService jobSchedulerService;

    public record ScheduleRequest(String jobName, String cronExpression, Map<String, String> parameters) {}

    @PostMapping
    public ResponseEntity<Map<String, String>> createSchedule(@RequestBody ScheduleRequest request) {
        String id = jobSchedulerService.registerSchedule(request.jobName(), request.cronExpression(), request.parameters());
        return ResponseEntity.ok(Map.of("id", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelSchedule(@PathVariable("id") String id) {
        jobSchedulerService.cancelSchedule(id);
        return ResponseEntity.ok().build();
    }
}
