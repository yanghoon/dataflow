package io.slim.workflow.app.adapter.workflow.event;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;
import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class EventExtractionWorkflow implements Workflow {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;

    @Override
    public String getType() {
        return "event-extraction";
    }

    @Override
    public void execute(WorkflowJob jobSnapshot, WorkflowParams params) {
        Map<String, String> props = jobSnapshot.props();
        String sqlPath = props.get("sqlPath");
        String status = props.get("status");
        String daysSinceLastLogin = props.get("daysSinceLastLogin");
        String eventSource = props.get("eventSource");
        String eventType = props.get("eventType");

        try {
            var resource = resourceLoader.getResource(sqlPath);
            String sql = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);

            MapSqlParameterSource sqlParams = new MapSqlParameterSource();
            sqlParams.addValue("status", status);
            sqlParams.addValue("daysSinceLastLogin", Integer.parseInt(daysSinceLastLogin));

            List<CloudEvent> events = jdbcTemplate.query(sql, sqlParams, (rs, rowNum) -> {
                try {
                    long customerId = rs.getLong("customer_id");
                    String currentStatus = rs.getString("status");
                    String lastLoginDateStr = rs.getString("last_login_date");

                    // 1. Natural Key (last_login_date 원본값 사용)
                    String naturalKey = customerId + "|dormant|" + lastLoginDateStr;
                    // 2. Deterministic UUIDv3
                    String eventId = UUID.nameUUIDFromBytes(naturalKey.getBytes(StandardCharsets.UTF_8)).toString();

                    Map<String, Object> payload = Map.of(
                            "customerId", customerId,
                            "status", currentStatus
                    );

                    return CloudEventBuilder.v1()
                            .withId(eventId)
                            .withSource(URI.create(eventSource))
                            .withType(eventType)
                            .withSubject(String.valueOf(customerId))
                            .withTime(OffsetDateTime.now())
                            .withDataContentType("application/json")
                            .withData(objectMapper.writeValueAsBytes(payload))
                            .build();
                } catch (Exception e) {
                    throw new RuntimeException("Failed to build event", e);
                }
            });

            saveEventsToQueue(events);
        } catch (Exception e) {
            log.error("Failed to execute EventExtractionWorkflow", e);
            throw new RuntimeException(e);
        }
    }

    private void saveEventsToQueue(List<CloudEvent> events) {
        if (events.isEmpty()) return;

        String insertSql = "INSERT INTO event_queue (id, source, type, subject, datacontenttype, data, time, status) " +
                           "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, 'PENDING') " +
                           "ON CONFLICT (id, source) DO NOTHING";

        int[] updateCounts = jdbcTemplate.getJdbcTemplate().batchUpdate(insertSql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                CloudEvent event = events.get(i);
                ps.setString(1, event.getId());
                ps.setString(2, event.getSource().toString());
                ps.setString(3, event.getType());
                ps.setString(4, event.getSubject());
                ps.setString(5, event.getDataContentType());
                ps.setString(6, new String(event.getData().toBytes(), StandardCharsets.UTF_8));
                ps.setObject(7, event.getTime());
            }

            @Override
            public int getBatchSize() {
                return events.size();
            }
        });

        int insertedCount = Arrays.stream(updateCounts).filter(c -> c > 0).sum();
        log.info("{} events found, {} uniquely inserted and queued.", events.size(), insertedCount);
    }
}
