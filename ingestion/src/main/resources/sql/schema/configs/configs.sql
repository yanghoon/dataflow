CREATE TABLE IF NOT EXISTS system_configs (
    config_key VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    config_value TEXT,
    options TEXT,
    group_name VARCHAR(255)
);
