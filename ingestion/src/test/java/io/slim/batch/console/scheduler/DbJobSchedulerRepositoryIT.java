package io.slim.batch.console.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.github.kagkarlsson.scheduler.SchedulerClient;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=false",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "db-scheduler.enabled=true"
})
public class DbJobSchedulerRepositoryIT {

    @Autowired
    private JobSchedulerRepository repository;

    @Autowired
    private SchedulerClient schedulerClient;

    @Test
    void testSaveUpdateAndDeleteSchedule() {
        String id = UUID.randomUUID().toString();
        String jobName = "testJob";
        String cron = "0 0 * * * *";
        Map<String, String> params = Map.of("param1", "value1");

        // Save schedule
        assertDoesNotThrow(() -> repository.save(id, jobName, cron, params));

        // Find all and verify
        var schedules = repository.findAll();
        assertThat(schedules).anyMatch(s -> s.id().equals(id) && s.jobName().equals(jobName) && s.cronExpression().equals(cron));

        // Update schedule
        String updatedCron = "0 30 * * * *";
        Map<String, String> updatedParams = Map.of("param1", "updatedValue");
        assertDoesNotThrow(() -> repository.update(id, jobName, updatedCron, updatedParams));

        var updatedSchedules = repository.findAll();
        assertThat(updatedSchedules).anyMatch(s -> s.id().equals(id) && s.cronExpression().equals(updatedCron));

        // Delete schedule
        assertDoesNotThrow(() -> repository.delete(id));
        var afterDelete = repository.findAll();
        assertThat(afterDelete).noneMatch(s -> s.id().equals(id));
    }
}
