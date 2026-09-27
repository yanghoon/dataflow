package io.slim.ingestion.batch.v2.app.infra.integration;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.repository.explore.JobExplorer;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.ingestion.batch.v2.app.infra.batch.SchemaAwareValidator;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@SpringBootTest(classes = {
    io.slim.ingestion.batch.TestApplication.class, 
    io.slim.ingestion.batch.v2.app.infra.rest.AdminJobController.class, 
    io.slim.ingestion.batch.v2.app.infra.rest.ValidationExceptionHandler.class
})
@AutoConfigureMockMvc
class AdminJobControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobLauncher jobLauncher;

    @MockitoBean
    private JobRegistry jobRegistry;

    @MockitoBean
    private JobExplorer jobExplorer;

    @MockitoBean
    private Job testJob;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws Exception {
        when(jobRegistry.getJob("testJob")).thenReturn(testJob);
        when(testJob.getJobParametersValidator()).thenReturn(new SchemaAwareValidator<>(TestDto.class, objectMapper));
    }

    @Test
    void testGetJobSchema() throws Exception {
        mockMvc.perform(get("/api/admin/jobs/testJob"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.type").value("object"))
            .andExpect(jsonPath("$.properties.name").exists());
    }

    @Test
    void testValidateJobParams_Success() throws Exception {
        String payload = "{\"name\":\"validName\"}";
        mockMvc.perform(post("/api/admin/jobs/testJob/params/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true));
    }

    @Test
    void testValidateJobParams_Failure() throws Exception {
        String payload = "{\"name\":\"\"}";
        mockMvc.perform(post("/api/admin/jobs/testJob/params/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$[0].field").value("name"))
            .andExpect(jsonPath("$[0].message").exists());
    }

    @Test
    void testLaunchJob() throws Exception {
        JobExecution execution = new JobExecution(1L, null, new JobParametersBuilder().toJobParameters());
        when(jobLauncher.run(any(Job.class), any(JobParameters.class))).thenReturn(execution);

        String payload = "{\"name\":\"validName\"}";
        mockMvc.perform(post("/api/admin/jobs/testJob/executions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.executionId").value(1));
    }

    @Test
    void testGetJobExecution() throws Exception {
        JobExecution execution = new JobExecution(1L, null, new JobParametersBuilder().toJobParameters());
        execution.setStatus(BatchStatus.COMPLETED);
        execution.setExitStatus(ExitStatus.COMPLETED);
        
        when(jobExplorer.getJobExecution(1L)).thenReturn(execution);

        mockMvc.perform(get("/api/admin/jobs/testJob/executions/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.executionId").value(1))
            .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Data
    public static class TestDto {
        @NotBlank
        private String name;
    }
}
