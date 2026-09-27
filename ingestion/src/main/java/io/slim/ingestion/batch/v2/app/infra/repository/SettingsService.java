package io.slim.ingestion.batch.v2.app.infra.repository;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {
    private final SettingsRepository repository;
    private final ApplicationEventPublisher eventPublisher;

    public SettingsService(SettingsRepository repository, ApplicationEventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void saveSetting(String key, String value) {
        repository.save(key, value);
        eventPublisher.publishEvent(new SettingChangedEvent(key, value));
    }
}
