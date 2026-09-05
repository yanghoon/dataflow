package io.slim.workflow.app.adapter.event.repo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Slf4j
@Repository
@RequiredArgsConstructor
public class EventCandidateRepository {

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<CloudEvent> findCandidates(String extractSql) {
        return jdbcTemplate.query(extractSql, cloudEventRowMapper());
    }

    public void updateStatusToDone(String updateSql, List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("ids", ids);
        namedParameterJdbcTemplate.update(updateSql, params);
    }

    public void updateStatusToFailed(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        String updateSql = "UPDATE outbox_event SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id IN (:ids)";
        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("ids", ids);
        namedParameterJdbcTemplate.update(updateSql, params);
    }

    public void updateRetry(String id, int retryCount, String nextRetryAt) {
        String updateSql = "UPDATE outbox_event SET extensions = COALESCE(extensions, '{}'::jsonb) || jsonb_build_object('retry_count', :retryCount, 'next_retry_at', :nextRetryAt), status = 'RETRY_PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = :id";
        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("id", id);
        params.addValue("retryCount", retryCount);
        params.addValue("nextRetryAt", nextRetryAt);
        namedParameterJdbcTemplate.update(updateSql, params);
    }

    private RowMapper<CloudEvent> cloudEventRowMapper() {
        return (rs, rowNum) -> {
            String id = rs.getString("id");
            String source = rs.getString("source");
            String type = rs.getString("type");
            String subject = rs.getString("subject");
            String data = rs.getString("data");
            String datacontenttype = rs.getString("datacontenttype");
            Timestamp time = rs.getTimestamp("time");

            var builder = CloudEventBuilder.v1()
                    .withId(id)
                    .withSource(URI.create(source != null ? source : "/default/source"))
                    .withType(type != null ? type : "unknown.type")
                    .withTime(time != null ? OffsetDateTime.ofInstant(time.toInstant(), ZoneId.of("UTC")) : OffsetDateTime.now(ZoneId.of("UTC")));

            if (subject != null) {
                builder.withSubject(subject);
            }
            if (data != null) {
                builder.withData(datacontenttype != null ? datacontenttype : "application/json", data.getBytes(StandardCharsets.UTF_8));
            }
            
            String extensions = rs.getString("extensions");
            if (extensions != null) {
                try {
                    Map<String, Object> extMap = objectMapper.readValue(extensions, new TypeReference<Map<String, Object>>() {});
                    for (Map.Entry<String, Object> entry : extMap.entrySet()) {
                        String extName = entry.getKey().replaceAll("[^a-z0-9]", ""); // CloudEvents spec requires alphanumeric lowercase
                        if (extName.isEmpty()) continue;
                        if (entry.getValue() instanceof String) {
                            builder.withExtension(extName, (String) entry.getValue());
                        } else if (entry.getValue() instanceof Number) {
                            builder.withExtension(extName, (Number) entry.getValue());
                        } else if (entry.getValue() instanceof Boolean) {
                            builder.withExtension(extName, (Boolean) entry.getValue());
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to parse extensions JSON", e);
                }
            }

            return builder.build();
        };
    }
}
