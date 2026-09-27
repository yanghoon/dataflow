package io.slim.ingestion.batch.v2.app.infra.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = {
    io.slim.ingestion.batch.TestApplication.class,
    io.slim.ingestion.batch.v2.app.infra.rest.ConfigController.class,
    io.slim.ingestion.batch.v2.app.infra.repository.SettingsService.class,
    io.slim.ingestion.batch.v2.app.infra.repository.SettingsRepository.class,
    io.slim.ingestion.batch.v2.app.infra.config.ConfigSchemaGenerator.class,
    io.slim.ingestion.batch.v2.app.infra.repository.SettingChangedEventListener.class
})
@AutoConfigureMockMvc
@Testcontainers
class ConfigControllerIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;
    
    @MockitoBean
    private SchedulerClient schedulerClient;

    @Test
    void testUpdateSettingUpdatesHistoryAndScheduler() throws Exception {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS settings (key VARCHAR(255) PRIMARY KEY, value TEXT)");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS setting_history (id SERIAL PRIMARY KEY, key VARCHAR(255), value TEXT, created_at TIMESTAMP)");

        mockMvc.perform(put("/api/config/settings/cron.dummy-job")
                .content("0 0 12 * * ?"))
                .andExpect(status().isOk());
                
        String value = jdbcTemplate.queryForObject("SELECT value FROM settings WHERE key = 'cron.dummy-job'", String.class);
        assertEquals("0 0 12 * * ?", value);

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM setting_history WHERE key = 'cron.dummy-job'", Integer.class);
        assertTrue(count > 0);
    }
}
