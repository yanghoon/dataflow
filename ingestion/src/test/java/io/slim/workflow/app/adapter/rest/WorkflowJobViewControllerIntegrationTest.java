package io.slim.workflow.app.adapter.rest;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.http.MediaType;
import org.mockito.Mockito;

import io.slim.workflow.app.config.workflow.WorkflowProperties;
import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowLauncher;
import io.slim.workflow.domain.WorkflowParams;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.assertThat;
import java.util.concurrent.TimeUnit;
import static org.awaitility.Awaitility.await;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.bind.BindException;
import org.springframework.boot.context.properties.source.ConfigurationPropertyName;
import org.springframework.boot.context.properties.source.ConfigurationProperty;
import static org.hamcrest.Matchers.containsString;
import java.time.LocalDate;
import java.lang.reflect.Constructor;
import org.springframework.boot.context.properties.bind.Bindable;

@SpringBootTest(properties = {
    "workflow.jobs.test-adhoc-job.name=test-adhoc-job",
    "workflow.jobs.test-adhoc-job.group=test-group",
    "workflow.jobs.test-adhoc-job.cron=0 0 0 1 1 ?",
    "workflow.jobs.test-adhoc-job.type=postgres-fdw",
    "workflow.jobs.test-adhoc-job.enabled=true",
    "workflow.jobs.test-adhoc-job.props.targetTable=default_table",
    "workflow.jobs.test-adhoc-job.allowedOverrides[0]=targetDate"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkflowJobViewControllerIntegrationTest {

    @TestConfiguration
    static class Config {
        @Bean
        public ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }

    @Autowired
    private WorkflowJobViewController controller;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WorkflowLauncher workflowLauncher;

    @Test
    void testRunAdhoc_ExecutesWorkflowWithMergedParams() throws Exception {
        // given
        var overrideParams = Map.of("targetDate", "2023-12-31");

        // when
        RunAdhocResponse response = controller.runAdhoc("test-adhoc-job", overrideParams);

        // then
        assertThat(response).isNotNull();
        assertThat(response.taskInstanceId()).startsWith("adhoc-test-adhoc-job-");
        // Scheduler executes asynchronously, so we wait and verify
        ArgumentCaptor<WorkflowParams> paramsCaptor = ArgumentCaptor.forClass(WorkflowParams.class);
        
        await().atMost(15, TimeUnit.SECONDS).untilAsserted(() -> {
            verify(workflowLauncher).launch(eq("test-adhoc-job"), paramsCaptor.capture());
            WorkflowParams launchedParams = paramsCaptor.getValue();
            assertThat(launchedParams.get("targetDate")).isEqualTo("2023-12-31");
        });
    }

    @Test
    void testRunAdhoc_ValidationFails_Returns400() throws Exception {
        // given
        var overrideParams = Map.of("invalid_param", "some_value");
        Mockito.doThrow(new IllegalArgumentException("허용되지 않은 파라미터입니다: invalid_param"))
            .when(workflowLauncher).validate(eq("test-adhoc-job"), any());

        // when & then
        mockMvc.perform(MockMvcRequestBuilders.post("/admin/workflow-jobs/test-adhoc-job/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content(new ObjectMapper().writeValueAsString(overrideParams)))
                .andExpect(MockMvcResultMatchers.status().isBadRequest())
                .andExpect(MockMvcResultMatchers.jsonPath("$.error").value("허용되지 않은 파라미터입니다: invalid_param"));
    }

    @Test
    void testListAll_ReturnsAllowedOverridesAndProps() {
        // when
        var views = controller.listAll();

        // then
        assertThat(views).isNotEmpty();
        var jobView = views.stream()
            .filter(v -> "test-adhoc-job".equals(v.jobName()))
            .findFirst()
            .orElseThrow();
        
        assertThat(jobView.allowedOverrides()).containsExactly("targetDate");
        assertThat(jobView.props()).containsEntry("targetTable", "default_table");
    }

    @Test
    void testRunAdhoc_BindExceptionValidationFails_Returns400() throws Exception {
        // given
        var overrideParams = Map.of("targetDate", "invalid-date");
        Constructor<BindException> constructor = BindException.class.getDeclaredConstructor(
                ConfigurationPropertyName.class, Bindable.class, 
                ConfigurationProperty.class, Throwable.class);
        constructor.setAccessible(true);
        BindException bindException = constructor.newInstance(
                ConfigurationPropertyName.of("targetDate"),
                Bindable.of(LocalDate.class),
                null,
                new Exception("parse error")
        );

        Mockito.doThrow(bindException)
            .when(workflowLauncher).validate(eq("test-adhoc-job"), any());

        // when & then
        mockMvc.perform(MockMvcRequestBuilders.post("/admin/workflow-jobs/test-adhoc-job/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content(new ObjectMapper().writeValueAsString(overrideParams)))
                .andExpect(MockMvcResultMatchers.status().isBadRequest())
                .andExpect(MockMvcResultMatchers.jsonPath("$.error").value(containsString("Binding failed for field 'targetDate'")));
    }
}
