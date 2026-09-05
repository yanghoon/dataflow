package io.slim.workflow.app.adapter.event.poller;

import io.slim.workflow.app.config.event.EventPollerConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.util.UUID;
import java.sql.Timestamp;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.atLeastOnce;
import io.slim.workflow.app.adapter.event.poller.JdbcEventMessagePoller;


@SpringBootTest(properties = {
    "spring.sql.init.schemaLocations=classpath:sql/schema/outbox_event.sql"
})
@Testcontainers
@ActiveProfiles("outbox")
class OutboxPollerDatabaseIntegrationTest {

    @org.springframework.boot.test.context.TestConfiguration
    static class TestConfig {
        @org.springframework.context.annotation.Bean
        public com.fasterxml.jackson.databind.ObjectMapper objectMapper() {
            return new com.fasterxml.jackson.databind.ObjectMapper();
        }
    }

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JdbcEventMessagePoller toolAPoller;

    @BeforeEach
    void setUp() {
        // Initialize the outbox_event table
        jdbcTemplate.execute(
            "CREATE TABLE IF NOT EXISTS outbox_event (" +
            "id VARCHAR(128) NOT NULL, " +
            "source VARCHAR(255) NOT NULL, " +
            "type VARCHAR(255) NOT NULL, " +
            "subject VARCHAR(255), " +
            "datacontenttype VARCHAR(50), " +
            "time TIMESTAMP WITH TIME ZONE NOT NULL, " +
            "data JSONB, " +
            "extensions JSONB, " +
            "status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'CONFIRMED', 'RETRY_PENDING', 'FAILED', 'CANCELLED')), " +
            "created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, " +
            "updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, " +
            "PRIMARY KEY (source, id)" +
            ")"
        );
        jdbcTemplate.execute("TRUNCATE TABLE outbox_event");
    }

    @Test
    void shouldProcessReadyEventAndMarkAsDone() {
        // Arrange
        String eventId = UUID.randomUUID().toString();
        jdbcTemplate.update(
            "INSERT INTO outbox_event (id, source, type, time, status) VALUES (?, ?, ?, ?, ?)",
            eventId, "/test", "customer.suspend.account", Timestamp.from(Instant.now()), "PENDING"
        );

        // Act
        toolAPoller.pollAndDispatch();

        // Assert
        // Verify that the status in the DB is updated to CONFIRMED
        String status = jdbcTemplate.queryForObject(
            "SELECT status FROM outbox_event WHERE id = ?",
            String.class,
            eventId
        );
        assertThat(status).isEqualTo("CONFIRMED");
    }
}
