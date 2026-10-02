package io.slim.batch.console.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import io.slim.batch.console.scheduler.JobSchedulerRepository.ScheduleDto;
import io.slim.batch.console.scheduler.JobSchedulerService;

@ExtendWith(MockitoExtension.class)
public class ScheduleControllerTest {

    private MockMvc mockMvc;

    @Mock
    private JobSchedulerService jobSchedulerService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ScheduleController(jobSchedulerService)).build();
    }

    @Test
    public void testGetSchedules() throws Exception {
        ScheduleDto scheduleDto = new ScheduleDto("id-1", "testJob", "0 0 * * * *", Map.of("key", "value"));
        when(jobSchedulerService.getSchedules()).thenReturn(List.of(scheduleDto));

        mockMvc.perform(get("/api/batch/schedules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("id-1"))
                .andExpect(jsonPath("$[0].jobName").value("testJob"))
                .andExpect(jsonPath("$[0].cronExpression").value("0 0 * * * *"));
    }

    @Test
    public void testCreateSchedule() throws Exception {
        when(jobSchedulerService.registerSchedule(eq("testJob"), eq("0 0 * * * *"), any())).thenReturn("generated-id");

        mockMvc.perform(post("/api/batch/schedules")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "jobName": "testJob",
                        "cronExpression": "0 0 * * * *",
                        "parameters": {"key": "value"}
                    }
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("generated-id"));
    }

    @Test
    public void testUpdateSchedule() throws Exception {
        mockMvc.perform(put("/api/batch/schedules/id-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "jobName": "testJob",
                        "cronExpression": "0 30 * * * *",
                        "parameters": {"key": "new-value"}
                    }
                """))
                .andExpect(status().isOk());

        verify(jobSchedulerService).updateSchedule(eq("id-1"), eq("testJob"), eq("0 30 * * * *"), any());
    }

    @Test
    public void testCancelSchedule() throws Exception {
        mockMvc.perform(delete("/api/batch/schedules/id-1"))
                .andExpect(status().isOk());

        verify(jobSchedulerService).cancelSchedule("id-1");
    }
}
