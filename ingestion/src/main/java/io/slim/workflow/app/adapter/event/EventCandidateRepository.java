package io.slim.workflow.app.adapter.event;

import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class EventCandidateRepository {

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

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

    private RowMapper<CloudEvent> cloudEventRowMapper() {
        return (rs, rowNum) -> {
            String id = rs.getString("id");
            String source = rs.getString("source");
            String type = rs.getString("type");
            String subject = rs.getString("subject");
            String dataPayload = rs.getString("data_payload");
            java.sql.Timestamp time = rs.getTimestamp("time");

            var builder = CloudEventBuilder.v1()
                    .withId(id)
                    .withSource(URI.create(source != null ? source : "/default/source"))
                    .withType(type != null ? type : "unknown.type")
                    .withTime(time != null ? OffsetDateTime.ofInstant(time.toInstant(), ZoneId.of("UTC")) : OffsetDateTime.now(ZoneId.of("UTC")));

            if (subject != null) {
                builder.withSubject(subject);
            }
            if (dataPayload != null) {
                builder.withData("application/json", dataPayload.getBytes(StandardCharsets.UTF_8));
            }

            return builder.build();
        };
    }
}
