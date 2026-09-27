package io.slim.ingestion.batch.v2.app.infra.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class SettingsRepository {
    private final JdbcTemplate jdbcTemplate;

    public SettingsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void save(String key, String value) {
        jdbcTemplate.update("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", key, value);
        jdbcTemplate.update("INSERT INTO setting_history (key, value, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)", key, value);
    }
}
