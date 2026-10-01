package io.slim.batch.console.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import org.springframework.test.context.ContextConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;

@WebMvcTest(BatchConsoleController.class)
@ContextConfiguration(classes = {BatchConsoleController.class})
public class BatchConsoleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobRegistry jobRegistry;

    @MockitoBean
    private JobLauncher jobLauncher;

    // Removed ObjectMapper

    @Test
    public void testGetJobNames() throws Exception {
        when(jobRegistry.getJobNames()).thenReturn(List.of("job1", "job2"));

        mockMvc.perform(get("/api/batch/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("job1"))
                .andExpect(jsonPath("$[1]").value("job2"));
    }

    @Test
    public void testLaunchJob() throws Exception {
        Job mockJob = org.mockito.Mockito.mock(Job.class);
        when(jobRegistry.getJob("job1")).thenReturn(mockJob);

        JobExecution mockExecution = org.mockito.Mockito.mock(JobExecution.class);
        when(mockExecution.getId()).thenReturn(100L);
        when(jobLauncher.run(eq(mockJob), any(JobParameters.class))).thenReturn(mockExecution);

        mockMvc.perform(post("/api/batch/jobs/job1/executions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"param1\": \"value1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executionId").value(100));
    }
}
