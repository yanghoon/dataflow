package io.slim.workflow.app.adapter.workflow.event;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.slim.workflow.domain.WorkflowJob;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DormantCustomerPolicyUnitTest {

    @Test
    void testTimeCalculationInExecute() throws Exception {
        NamedParameterJdbcTemplate jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        ObjectMapper objectMapper = new ObjectMapper();
        ResourceLoader resourceLoader = mock(ResourceLoader.class);
        
        Resource mockResource = mock(Resource.class);
        InputStream mockInputStream = new ByteArrayInputStream("SELECT 1".getBytes());
        when(mockResource.getInputStream()).thenReturn(mockInputStream);
        when(resourceLoader.getResource(anyString())).thenReturn(mockResource);
        
        // Fix the clock to 2026-09-27T00:00:00Z
        Clock fixedClock = Clock.fixed(Instant.parse("2026-09-27T00:00:00Z"), ZoneId.of("UTC"));
        
        DormantCustomerPolicy policy = new DormantCustomerPolicy(jdbcTemplate, objectMapper, resourceLoader, fixedClock);
        
        WorkflowJob job = mock(WorkflowJob.class);
        when(job.props()).thenReturn(Map.of("thresholdDays", "10", "sqlPath", "classpath:dummy.sql"));
        when(job.name()).thenReturn("dummy-job");

        policy.execute(job, null);
        
        ArgumentCaptor<MapSqlParameterSource> captor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).query(anyString(), captor.capture(), any(org.springframework.jdbc.core.RowCallbackHandler.class));
        
        // 2026-09-27 minus 10 days = 2026-09-17
        assertEquals("2026-09-17", captor.getValue().getValue("cutoffDate"));
    }
}
