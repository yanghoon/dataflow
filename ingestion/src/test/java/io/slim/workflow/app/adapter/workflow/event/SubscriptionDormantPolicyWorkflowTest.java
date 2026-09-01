package io.slim.workflow.app.adapter.workflow.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;

@SpringBootTest(properties = {
    "spring.sql.init.schemaLocations=classpath:sql/schema/db_scheduler.sql,classpath:sql/schema/customers/customers.sql,classpath:sql/schema/event_queue.sql,classpath:sql/schema/outbox_event.sql"
})
@Testcontainers
@Import(SubscriptionDormantPolicyWorkflowTest.TestConfig.class)
public class SubscriptionDormantPolicyWorkflowTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private SubscriptionDormantPolicyWorkflow workflow;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @TestConfiguration
    static class TestConfig {
        @Bean
        public ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }

    @Test
    @DisplayName("유닛테스트: 고유 Key 생성 로직 검증 (Edge Case)")
    void testEventIdGeneration() {
        // Normal case
        SubscriptionDormantPolicyWorkflow.EventId id1 = SubscriptionDormantPolicyWorkflow.EventId.generate("cust1", "2020-01-01");
        assertThat(id1.naturalKey()).isEqualTo("cust1|subscription-dormant-policy|2020-01-01");
        assertThat(id1.uuid()).isNotNull();

        // Edge case: empty string
        SubscriptionDormantPolicyWorkflow.EventId id2 = SubscriptionDormantPolicyWorkflow.EventId.generate("", "");
        assertThat(id2.naturalKey()).isEqualTo("|subscription-dormant-policy|");

        // Consistency check
        SubscriptionDormantPolicyWorkflow.EventId id3 = SubscriptionDormantPolicyWorkflow.EventId.generate("cust1", "2020-01-01");
        assertThat(id1.uuid()).isEqualTo(id3.uuid());
    }

    @Test
    @DisplayName("통합테스트: 실제 쿼리 실행 및 ON CONFLICT 중복 방어 작동 여부 검증")
    void testIntegration() {
        // 1. Prepare schema
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS outbox_event (
                id VARCHAR(255) PRIMARY KEY,
                source VARCHAR(255),
                type VARCHAR(255),
                subject VARCHAR(255),
                datacontenttype VARCHAR(255),
                data JSONB,
                extensions JSONB,
                time TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50),
                UNIQUE (source, id)
            )
        """);

        // mock customers_csv
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS customers_csv (
                index_id INTEGER PRIMARY KEY,
                customer_id VARCHAR(50) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                company VARCHAR(255),
                city VARCHAR(100),
                country VARCHAR(100),
                phone_1 VARCHAR(50),
                phone_2 VARCHAR(50),
                email VARCHAR(255),
                subscription_date DATE,
                website VARCHAR(255)
            )
        """);

        jdbcTemplate.execute("TRUNCATE TABLE customers_csv");
        jdbcTemplate.execute("TRUNCATE TABLE outbox_event");

        // Insert test data
        jdbcTemplate.execute("INSERT INTO customers_csv (index_id, customer_id, first_name, last_name, subscription_date, email) VALUES (1, 'C1', 'John', 'Doe', '2019-12-31', 'john@test.com')");
        jdbcTemplate.execute("INSERT INTO customers_csv (index_id, customer_id, first_name, last_name, subscription_date, email) VALUES (2, 'C2', 'Jane', 'Doe', CURRENT_DATE, 'jane@test.com')");
        jdbcTemplate.execute("INSERT INTO customers_csv (index_id, customer_id, first_name, last_name, subscription_date, email) VALUES (3, 'C3', 'Jim', 'Doe', null, null)");

        WorkflowJob job = new WorkflowJob(
            "job1",
            "test-workflow",
            "subscription-dormant-policy",
            false,
            "1 * * * *",
            Map.of("sqlPath", "classpath:test_dormant.sql", "thresholdDays", "20"),
            java.util.Set.of()
        );

        WorkflowParams emptyParams = new WorkflowParams(Map.of());

        // 1st Execution
        workflow.execute(job, emptyParams);
        
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM outbox_event", Integer.class);
        // Expecting C1 and C3 to be matched by test_dormant.sql
        assertThat(count).isEqualTo(2);

        // 2nd Execution - Should not throw and count should remain same due to ON CONFLICT DO NOTHING
        assertDoesNotThrow(() -> workflow.execute(job, emptyParams));
        
        Integer countAfter = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM outbox_event", Integer.class);
        assertThat(countAfter).isEqualTo(2);
    }
}
