package io.slim.workflow.app.adapter.workflow.event;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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
@RequiredArgsConstructor
public abstract class AbstractPolicy implements Workflow {

    protected final NamedParameterJdbcTemplate jdbcTemplate;
    protected final ObjectMapper objectMapper;
    protected final ResourceLoader resourceLoader;

    public interface EventMapper {
        io.cloudevents.CloudEvent map(java.sql.ResultSet rs, io.cloudevents.core.builder.CloudEventBuilder builder) throws Exception;
    }

    protected void extractAndSaveEvents(WorkflowJob jobSnapshot, MapSqlParameterSource sqlParams, EventMapper mapper) {
        Map<String, String> props = jobSnapshot.props();
        if (props == null) {
            props = Map.of();
        }
        String sqlPath = props.getOrDefault("sqlPath", "classpath:default.sql");
        String eventSource = props.getOrDefault("eventSource", "defaultSource");
        String eventType = props.getOrDefault("eventType", "defaultType");

        try {
            var resource = resourceLoader.getResource(sqlPath);
            String sql;
            try (var inputStream = resource.getInputStream()) {
                sql = StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);
            }

            List<CloudEvent> batch = new ArrayList<>();
            final int batchSize = 500;

            jdbcTemplate.query(sql, sqlParams, rs -> {
                try {
                    CloudEventBuilder builder = CloudEventBuilder.v1()
                            .withSource(URI.create(eventSource))
                            .withType(eventType)
                            .withTime(OffsetDateTime.now());

                    CloudEvent event = mapper.map(rs, builder);

                    batch.add(event);
                    if (batch.size() >= batchSize) {
                        saveEventsToQueue(batch);
                        batch.clear();
                    }
                } catch (Exception e) {
                    throw new RuntimeException("Failed to build event", e);
                }
            });

            if (!batch.isEmpty()) {
                saveEventsToQueue(batch);
            }
        } catch (Exception e) {
            log.error("Failed to execute {}", getType(), e);
            throw new RuntimeException(e);
        }
    }

    private void saveEventsToQueue(List<CloudEvent> events) {
        if (events.isEmpty()) return;

        String insertSql = "INSERT INTO outbox_event (id, source, type, subject, datacontenttype, data, extensions, time, status) " +
                           "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, 'READY') " +
                           "ON CONFLICT (source, id) DO NOTHING";

        int[] updateCounts = jdbcTemplate.getJdbcTemplate().batchUpdate(insertSql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                CloudEvent event = events.get(i);
                ps.setString(1, event.getId());
                ps.setString(2, event.getSource().toString());
                ps.setString(3, event.getType());
                ps.setString(4, event.getSubject());
                ps.setString(5, event.getDataContentType());
                ps.setString(6, event.getData() != null ? new String(event.getData().toBytes(), StandardCharsets.UTF_8) : null);
                ps.setString(7, null); // extensions
                ps.setObject(8, event.getTime());
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
