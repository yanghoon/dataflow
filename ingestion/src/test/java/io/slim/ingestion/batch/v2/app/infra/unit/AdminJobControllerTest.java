package io.slim.ingestion.batch.v2.app.infra.unit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.repository.explore.JobExplorer;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.ingestion.batch.v2.app.infra.batch.SchemaAwareValidator;
import io.slim.ingestion.batch.v2.app.infra.rest.AdminJobController;
import io.slim.ingestion.batch.v2.app.infra.rest.ValidationExceptionHandler;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@ExtendWith(MockitoExtension.class)
class AdminJobControllerTest {

    private MockMvc mockMvc;

    @Mock
    private JobLauncher jobLauncher;

    @Mock
    private JobRegistry jobRegistry;

    @Mock
    private JobExplorer jobExplorer;

    @Mock
    private Job testJob;

    private ObjectMapper objectMapper = new ObjectMapper();

    private AdminJobController adminJobController;

    @BeforeEach
    void setUp() throws Exception {
        adminJobController = new AdminJobController(jobRegistry, jobLauncher, jobExplorer, objectMapper);
        mockMvc = MockMvcBuilders.standaloneSetup(adminJobController)
                .setControllerAdvice(new ValidationExceptionHandler())
                .build();
    }

    @Test
    void testGetJobSchema() throws Exception {
        when(jobRegistry.getJob("testJob")).thenReturn(testJob);
        when(testJob.getJobParametersValidator()).thenReturn(new SchemaAwareValidator<>(TestDto.class, objectMapper));

        mockMvc.perform(get("/api/admin/jobs/testJob"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.type").value("object"))
            .andExpect(jsonPath("$.properties.name").exists());
    }

    @Test
    void testValidateJobParams_Success() throws Exception {
        when(jobRegistry.getJob("testJob")).thenReturn(testJob);
        when(testJob.getJobParametersValidator()).thenReturn(new SchemaAwareValidator<>(TestDto.class, objectMapper));

        String payload = "{\"name\":\"validName\"}";
        mockMvc.perform(post("/api/admin/jobs/testJob/params/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true));
    }

    @Test
    void testValidateJobParams_Failure() throws Exception {
        when(jobRegistry.getJob("testJob")).thenReturn(testJob);
        when(testJob.getJobParametersValidator()).thenReturn(new SchemaAwareValidator<>(TestDto.class, objectMapper));

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
        when(jobRegistry.getJob("testJob")).thenReturn(testJob);
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
        execution.setStartTime(java.time.LocalDateTime.now());
        execution.setEndTime(java.time.LocalDateTime.now());
        
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
