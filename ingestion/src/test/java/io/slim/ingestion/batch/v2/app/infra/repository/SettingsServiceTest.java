package io.slim.ingestion.batch.v2.app.infra.repository;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class SettingsServiceTest {

    @Test
    void testSaveSettingPublishesEvent() {
        SettingsRepository repository = mock(SettingsRepository.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        SettingsService service = new SettingsService(repository, publisher);

        service.saveSetting("testKey", "testValue");

        verify(repository).save("testKey", "testValue");
        
        ArgumentCaptor<SettingChangedEvent> captor = ArgumentCaptor.forClass(SettingChangedEvent.class);
        verify(publisher).publishEvent(captor.capture());
        
        SettingChangedEvent event = captor.getValue();
        assertEquals("testKey", event.getKey());
        assertEquals("testValue", event.getValue());
    }
}
