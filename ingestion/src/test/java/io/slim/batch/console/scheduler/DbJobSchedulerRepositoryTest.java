package io.slim.batch.console.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.github.kagkarlsson.scheduler.ScheduledExecution;
import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstance;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;

import io.slim.batch.console.scheduler.JobSchedulerRepository.ScheduleDto;
import io.slim.workflow.app.adapter.scheduler.WorkflowScheduleData;
import io.slim.workflow.domain.WorkflowJob;

@ExtendWith(MockitoExtension.class)
public class DbJobSchedulerRepositoryTest {

    @Mock
    private SchedulerClient schedulerClient;

    private DbJobSchedulerRepository repository;

    @BeforeEach
    void setUp() {
        repository = new DbJobSchedulerRepository(schedulerClient);
    }

    @Test
    void testSave() {
        repository.save("sched-1", "testJob", "0 0 * * * *", Map.of("key", "val"));
        verify(schedulerClient).schedule(any(TaskInstance.class), any(Instant.class));
    }

    @Test
    void testDelete() {
        repository.delete("sched-1");
        verify(schedulerClient).cancel(TaskInstanceId.of("workflowjob", "sched-1"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testFindAll_WithRunningStatus() {
        ScheduledExecution<Object> execution = mock(ScheduledExecution.class);
        TaskInstanceId taskInstanceId = TaskInstanceId.of("workflowjob", "sched-1");
        when(execution.getTaskInstance()).thenReturn(taskInstanceId);

        WorkflowJob job = new WorkflowJob("testJob", null, "0 0 * * * *", true, "SCHEDULED", Map.of("k", "v"), null);
        Instant createdAt = Instant.parse("2026-10-01T00:00:00Z");
        WorkflowScheduleData data = new WorkflowScheduleData(null, null, job, createdAt);
        when(execution.getData()).thenReturn(data);
        when(execution.isPicked()).thenReturn(true);
        when(execution.getLastSuccess()).thenReturn(null);
        when(execution.getLastFailure()).thenReturn(null);

        when(schedulerClient.getScheduledExecutions()).thenReturn(List.of(execution));

        List<ScheduleDto> result = repository.findAll();

        assertThat(result).hasSize(1);
        ScheduleDto dto = result.get(0);
        assertThat(dto.id()).isEqualTo("sched-1");
        assertThat(dto.jobName()).isEqualTo("testJob");
        assertThat(dto.createdAt()).isEqualTo(createdAt);
        assertThat(dto.lastStatus()).isEqualTo("RUNNING");
        assertThat(dto.lastExecutionTime()).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void testFindAll_WithSuccessStatus() {
        ScheduledExecution<Object> execution = mock(ScheduledExecution.class);
        TaskInstanceId taskInstanceId = TaskInstanceId.of("workflowjob", "sched-2");
        when(execution.getTaskInstance()).thenReturn(taskInstanceId);

        WorkflowJob job = new WorkflowJob("successJob", null, "0 0 * * * *", true, "SCHEDULED", Map.of(), null);
        Instant createdAt = Instant.parse("2026-10-01T00:00:00Z");
        Instant lastSuccess = Instant.parse("2026-10-02T09:00:00Z");
        Instant lastFailure = Instant.parse("2026-10-02T08:00:00Z");
        WorkflowScheduleData data = new WorkflowScheduleData(null, null, job, createdAt);

        when(execution.getData()).thenReturn(data);
        when(execution.isPicked()).thenReturn(false);
        when(execution.getLastSuccess()).thenReturn(lastSuccess);
        when(execution.getLastFailure()).thenReturn(lastFailure);

        when(schedulerClient.getScheduledExecutions()).thenReturn(List.of(execution));

        List<ScheduleDto> result = repository.findAll();

        assertThat(result).hasSize(1);
        ScheduleDto dto = result.get(0);
        assertThat(dto.id()).isEqualTo("sched-2");
        assertThat(dto.lastStatus()).isEqualTo("SUCCESS");
        assertThat(dto.lastExecutionTime()).isEqualTo(lastSuccess);
    }

    @Test
    @SuppressWarnings("unchecked")
    void testFindAll_WithNoExecutions() {
        ScheduledExecution<Object> execution = mock(ScheduledExecution.class);
        TaskInstanceId taskInstanceId = TaskInstanceId.of("workflowjob", "sched-3");
        when(execution.getTaskInstance()).thenReturn(taskInstanceId);

        WorkflowJob job = new WorkflowJob("idleJob", null, "0 0 * * * *", true, "SCHEDULED", Map.of(), null);
        Instant createdAt = Instant.parse("2026-10-01T00:00:00Z");
        WorkflowScheduleData data = new WorkflowScheduleData(null, null, job, createdAt);

        when(execution.getData()).thenReturn(data);
        when(execution.isPicked()).thenReturn(false);
        when(execution.getLastSuccess()).thenReturn(null);
        when(execution.getLastFailure()).thenReturn(null);

        when(schedulerClient.getScheduledExecutions()).thenReturn(List.of(execution));

        List<ScheduleDto> result = repository.findAll();

        assertThat(result).hasSize(1);
        ScheduleDto dto = result.get(0);
        assertThat(dto.id()).isEqualTo("sched-3");
        assertThat(dto.lastStatus()).isNull();
        assertThat(dto.lastExecutionTime()).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void testFindAll_WithNullCreatedAt() {
        ScheduledExecution<Object> execution = mock(ScheduledExecution.class);
        TaskInstanceId taskInstanceId = TaskInstanceId.of("workflowjob", "sched-4");
        when(execution.getTaskInstance()).thenReturn(taskInstanceId);

        WorkflowJob job = new WorkflowJob("legacyJob", null, "0 0 * * * *", true, "SCHEDULED", Map.of(), null);
        WorkflowScheduleData data = new WorkflowScheduleData(null, null, job, null);

        when(execution.getData()).thenReturn(data);
        when(execution.isPicked()).thenReturn(false);
        when(execution.getLastSuccess()).thenReturn(null);
        when(execution.getLastFailure()).thenReturn(null);

        when(schedulerClient.getScheduledExecutions()).thenReturn(List.of(execution));

        List<ScheduleDto> result = repository.findAll();

        assertThat(result).hasSize(1);
        ScheduleDto dto = result.get(0);
        assertThat(dto.createdAt()).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void testFindAll_WithFailureStatus() {
        ScheduledExecution<Object> execution = mock(ScheduledExecution.class);
        TaskInstanceId taskInstanceId = TaskInstanceId.of("workflowjob", "sched-5");
        when(execution.getTaskInstance()).thenReturn(taskInstanceId);

        WorkflowJob job = new WorkflowJob("failJob", null, "0 0 * * * *", true, "SCHEDULED", Map.of(), null);
        Instant createdAt = Instant.parse("2026-10-01T00:00:00Z");
        Instant lastSuccess = Instant.parse("2026-10-02T08:00:00Z");
        Instant lastFailure = Instant.parse("2026-10-02T09:00:00Z");
        WorkflowScheduleData data = new WorkflowScheduleData(null, null, job, createdAt);

        when(execution.getData()).thenReturn(data);
        when(execution.isPicked()).thenReturn(false);
        when(execution.getLastSuccess()).thenReturn(lastSuccess);
        when(execution.getLastFailure()).thenReturn(lastFailure);

        when(schedulerClient.getScheduledExecutions()).thenReturn(List.of(execution));

        List<ScheduleDto> result = repository.findAll();

        assertThat(result).hasSize(1);
        ScheduleDto dto = result.get(0);
        assertThat(dto.lastStatus()).isEqualTo("FAILED");
        assertThat(dto.lastExecutionTime()).isEqualTo(lastFailure);
    }
}
