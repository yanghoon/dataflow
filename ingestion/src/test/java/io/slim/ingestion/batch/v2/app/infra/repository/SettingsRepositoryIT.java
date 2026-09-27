package io.slim.ingestion.batch.v2.app.infra.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@Testcontainers
class SettingsRepositoryIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void testSaveSettings() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS settings (key VARCHAR(255) PRIMARY KEY, value TEXT)");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS setting_history (id SERIAL PRIMARY KEY, key VARCHAR(255), value TEXT, created_at TIMESTAMP)");

        SettingsRepository repository = new SettingsRepository(jdbcTemplate);
        repository.save("testKey", "testValue");
        
        String value = jdbcTemplate.queryForObject("SELECT value FROM settings WHERE key = 'testKey'", String.class);
        assertEquals("testValue", value);

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM setting_history WHERE key = 'testKey'", Integer.class);
        assertEquals(1, count);
    }
}
