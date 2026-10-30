package io.slim.workflow.app.adapter.workflow.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.workflow.app.config.workflow.WorkflowProperties;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;

@SpringBootTest(properties = {
    "spring.config.import=classpath:application-dormant-policy.yml",
    "spring.sql.init.schemaLocations=classpath:sql/schema/db_scheduler.sql,classpath:sql/schema/customers/customers.sql,classpath:sql/schema/event_queue.sql,classpath:sql/schema/outbox_event.sql"
})
@Testcontainers
@Import(DormantCustomerPolicyYamlIntegrationTest.TestConfig.class)
public class DormantCustomerPolicyYamlIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:alpine");

    @Autowired
    private WorkflowProperties workflowProperties;

    @Autowired
    private DormantCustomerPolicy workflow;

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
    @DisplayName("통합테스트: 실제 YAML 설정(application-dormant-policy.yml)을 읽고 Workflow를 실행하여 동작 검증")
    void testIntegrationWithYamlJob() {
        // 1. Prepare schema and truncate tables
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

        jdbcTemplate.execute("TRUNCATE TABLE customers");
        jdbcTemplate.execute("TRUNCATE TABLE outbox_event");

        // Insert test data (threshold is 20 days in yaml)
        // C1: 25 days ago -> should be processed (<= CURRENT_DATE - 20)
        jdbcTemplate.execute("INSERT INTO customers (snapshot_date, system_id, index_id, customer_id, first_name, last_name, subscription_date, email) VALUES (CURRENT_DATE, 'sys1', 1, 'C1', 'John', 'Doe', CURRENT_DATE - INTERVAL '25 days', 'john@test.com')");
        // C2: 10 days ago -> should be ignored
        jdbcTemplate.execute("INSERT INTO customers (snapshot_date, system_id, index_id, customer_id, first_name, last_name, subscription_date, email) VALUES (CURRENT_DATE, 'sys2', 2, 'C2', 'Jane', 'Doe', CURRENT_DATE - INTERVAL '10 days', 'jane@test.com')");

        // 2. Fetch job configuration from YAML properties
        WorkflowJob job = workflowProperties.jobs().get("customer-dormant-policy-job");
        assertThat(job).isNotNull();
        assertThat(job.type()).isEqualTo("customer-dormant-policy");
        assertThat(job.cron()).isEqualTo("0 0 3 * * *");
        assertThat(job.props().get("thresholdDays")).isEqualTo("20");
        assertThat(job.props().get("sqlPath")).isEqualTo("classpath:sql/dormant_customer_policy.sql");

        // 3. Execute the workflow with the loaded job config
        WorkflowParams emptyParams = new WorkflowParams(Map.of());
        assertDoesNotThrow(() -> workflow.execute(job, emptyParams));

        // 4. Verify results (Only C1 matched)
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM outbox_event", Integer.class);
        assertThat(count).isEqualTo(1);
    }
}
