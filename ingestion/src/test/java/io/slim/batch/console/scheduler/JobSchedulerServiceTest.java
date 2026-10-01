package io.slim.batch.console.scheduler;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
public class JobSchedulerServiceTest {

    @Mock
    private JobSchedulerRepository repository;

    private DbJobSchedulerService service;

    @BeforeEach
    void setUp() {
        service = new DbJobSchedulerService(repository);
    }

    @Test
    void registerSchedule_shouldGenerateIdAndCallRepository() {
        String jobName = "testJob";
        String cron = "0 0 * * * *";
        Map<String, String> params = Map.of("key", "value");

        String id = service.registerSchedule(jobName, cron, params);

        assertNotNull(id);
        verify(repository).save(eq(id), eq(jobName), eq(cron), eq(params));
    }

    @Test
    void cancelSchedule_shouldCallRepository() {
        String id = "test-id";
        service.cancelSchedule(id);
        verify(repository).delete(eq(id));
    }
}
