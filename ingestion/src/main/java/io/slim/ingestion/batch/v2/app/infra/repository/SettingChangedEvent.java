package io.slim.ingestion.batch.v2.app.infra.repository;

public class SettingChangedEvent {
    private final String key;
    private final String value;

    public SettingChangedEvent(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() { return key; }
    public String getValue() { return value; }
}
