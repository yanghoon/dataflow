package io.slim.ingestion.batch.v2.app.job.async;

import org.springframework.batch.test.context.SpringBatchTest;
import org.springframework.batch.test.JobLauncherTestUtils;

import io.slim.ingestion.batch.v2.app.config.job.AsyncApiSyncJobConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.test.JobLauncherTestUtils;
import org.springframework.batch.test.context.SpringBatchTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.util.StopWatch;

import javax.sql.DataSource;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@SpringBatchTest
@SpringBootTest(classes = AsyncApiStepTest.TestConfig.class, properties = {"spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1", "spring.datasource.driver-class-name=org.h2.Driver", "spring.batch.jdbc.initialize-schema=always"})
@ActiveProfiles("test")
public class AsyncApiStepTest {

    @Autowired
    private JobLauncherTestUtils jobLauncherTestUtils;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private ExternalApiClient externalApiClient;

    @Configuration
    @EnableAutoConfiguration
    @Import({AsyncApiSyncJobConfig.class})
    static class TestConfig {
    }

    @BeforeEach
    public void setUp() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS users");
        jdbcTemplate.execute("DROP TABLE IF EXISTS success_log");
        jdbcTemplate.execute("DROP TABLE IF EXISTS failure_log");

        jdbcTemplate.execute("CREATE TABLE users (id BIGINT PRIMARY KEY, email VARCHAR(255), last_login_date VARCHAR(255))");
        jdbcTemplate.execute("CREATE TABLE success_log (item_key BIGINT, created_at TIMESTAMP)");
        jdbcTemplate.execute("CREATE TABLE failure_log (item_key BIGINT, error_message VARCHAR(255), created_at TIMESTAMP)");

        // Insert test data
        // run.date = 2026-09-20, threshold = 2025-09-20
        jdbcTemplate.execute("INSERT INTO users (id, email, last_login_date) VALUES (1, 'user1@test.com', '2024-01-01')");
        jdbcTemplate.execute("INSERT INTO users (id, email, last_login_date) VALUES (2, 'user2@test.com', '2024-02-01')");
        jdbcTemplate.execute("INSERT INTO users (id, email, last_login_date) VALUES (3, 'user3@test.com', '2024-03-01')");
        jdbcTemplate.execute("INSERT INTO users (id, email, last_login_date) VALUES (4, 'user4@test.com', '2024-04-01')");
        jdbcTemplate.execute("INSERT INTO users (id, email, last_login_date) VALUES (5, 'user5@test.com', '2024-05-01')");
        // user 6 is not dormant
        jdbcTemplate.execute("INSERT INTO users (id, email, last_login_date) VALUES (6, 'user6@test.com', '2026-01-01')");
    }

    @Test
    public void testAsyncApiSync_AllSuccess_And_ConcurrentExecution() throws Exception {
        // Given
        doAnswer(invocation -> {
            Thread.sleep(100);
            return null;
        }).when(externalApiClient).syncUser(anyLong());

        JobParameters params = new JobParametersBuilder()
                .addString("run.date", "2026-09-20")
                .addLong("time", System.currentTimeMillis())
                .toJobParameters();

        // When
        StopWatch stopWatch = new StopWatch();
        stopWatch.start();
        JobExecution jobExecution = jobLauncherTestUtils.launchJob(params);
        stopWatch.stop();

        // Then
        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED);

        // Verify elapsed time (concurrency test)
        long elapsedMs = stopWatch.getTotalTimeMillis();
        System.out.println("Elapsed Time: " + elapsedMs + "ms");
        assertThat(elapsedMs).isLessThan(400); // Because batch overhead exists, 200ms might be strict, but let's check. 5*100ms = 500ms sequential.

        // Verify counts
        Integer successCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM success_log", Integer.class);
        Integer failureCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM failure_log", Integer.class);

        assertThat(successCount).isEqualTo(5);
        assertThat(failureCount).isEqualTo(0);
    }

    @Test
    public void testAsyncApiSync_PartialFailure() throws Exception {
        // Given
        doAnswer(invocation -> {
            Long id = invocation.getArgument(0);
            Thread.sleep(100);
            if (id == 3L) {
                throw new RuntimeException("API Timeout");
            }
            return null;
        }).when(externalApiClient).syncUser(anyLong());

        JobParameters params = new JobParametersBuilder()
                .addString("run.date", "2026-09-20")
                .addLong("time", System.currentTimeMillis())
                .toJobParameters();

        // When
        JobExecution jobExecution = jobLauncherTestUtils.launchJob(params);

        // Then
        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED); // We caught exception, so chunk shouldn't fail the step

        Integer successCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM success_log", Integer.class);
        Integer failureCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM failure_log", Integer.class);

        assertThat(successCount).isEqualTo(4);
        assertThat(failureCount).isEqualTo(1);

        Map<String, Object> failureLog = jdbcTemplate.queryForMap("SELECT item_key, error_message FROM failure_log WHERE item_key = 3");
        assertThat(failureLog.get("item_key")).isEqualTo(3L);
        assertThat((String) failureLog.get("error_message")).contains("API Timeout");
    }
}
