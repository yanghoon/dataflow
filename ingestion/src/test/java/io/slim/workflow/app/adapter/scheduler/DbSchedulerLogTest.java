package io.slim.workflow.app.adapter.scheduler;

import com.github.kagkarlsson.scheduler.Scheduler;
import com.github.kagkarlsson.scheduler.task.Task;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import io.slim.ingestion.batch.BatchApplication;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = BatchApplication.class)
@ActiveProfiles("default")
@TestPropertySource(properties = {
    "spring.sql.init.mode=always",
    "spring.sql.init.schema-locations=classpath:sql/schema/db_scheduler.sql",
    "spring.datasource.url=jdbc:postgresql://localhost:5432/dataflow",
    "spring.datasource.username=postgres-local",
    "spring.datasource.password=postgres-local",
    "spring.datasource.driverClassName=org.postgresql.Driver"
})
public class DbSchedulerLogTest {

    @Autowired
    private Scheduler scheduler;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    @Qualifier("simpleTestTask")
    private Task<Void> simpleTestTask;

    @Test
    public void testOneTimeTaskLeavesLog() throws InterruptedException {
        String instanceId = "instance-test-" + UUID.randomUUID().toString();
        
        // Schedule the simple-one-time-task
        scheduler.schedule(simpleTestTask.instance(instanceId), Instant.now());

        // Wait up to 10 seconds for the task to finish executing and log to be written
        boolean found = false;
        for (int i = 0; i < 10; i++) {
            Thread.sleep(1000);
            Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM scheduled_execution_logs WHERE task_name = ? AND task_instance = ?",
                Integer.class,
                "simple-one-time-task",
                instanceId
            );
            if (count != null && count > 0) {
                found = true;
                break;
            }
        }

        assertThat(found).as("Log should be written to scheduled_execution_logs table for simple-one-time-task").isTrue();
    }
}
