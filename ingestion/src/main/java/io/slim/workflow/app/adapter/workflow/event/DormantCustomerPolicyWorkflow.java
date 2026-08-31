package io.slim.workflow.app.adapter.workflow.event;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.util.Map;
import java.util.UUID;

import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;

@Component
public class DormantCustomerPolicyWorkflow extends AbstractPolicyWorkflow {

    public DormantCustomerPolicyWorkflow(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        super(jdbcTemplate, objectMapper, resourceLoader);
    }

    @Override
    public String getType() {
        return "dormant-customer-policy";
    }

    @Override
    public void execute(io.slim.workflow.domain.WorkflowJob jobSnapshot, io.slim.workflow.domain.WorkflowParams params) {
        Map<String, String> props = jobSnapshot.props();
        if (props == null) {
            props = Map.of();
        }
        String status = props.getOrDefault("status", "ACTIVE");
        String daysSinceLastLogin = props.getOrDefault("daysSinceLastLogin", "365");

        MapSqlParameterSource sqlParams = new MapSqlParameterSource();
        sqlParams.addValue("status", status);
        sqlParams.addValue("daysSinceLastLogin", Integer.parseInt(daysSinceLastLogin));
        
        super.extractAndSaveEvents(jobSnapshot, sqlParams, this::toEvent);
    }

    protected record EventId(String naturalKey, String uuid) {
        public static EventId generate(long customerId, String lastLoginDate) {
            String naturalKey = customerId + "|dormant|" + lastLoginDate;
            String uuid = UUID.nameUUIDFromBytes(naturalKey.getBytes(StandardCharsets.UTF_8)).toString();
            return new EventId(naturalKey, uuid);
        }
    }

    protected CloudEvent toEvent(ResultSet rs, CloudEventBuilder builder) throws Exception {
        long customerId = rs.getLong("customer_id");
        String currentStatus = rs.getString("status");
        String lastLoginDateStr = rs.getString("last_login_date");

        EventId eventId = EventId.generate(customerId, lastLoginDateStr);

        Map<String, Object> payload = Map.of(
                "customerId", customerId,
                "status", currentStatus
        );

        return builder
                .withId(eventId.uuid())
                .withSubject(String.valueOf(customerId))
                .withDataContentType("application/json")
                .withData(objectMapper.writeValueAsBytes(payload))
                .build();
    }
}
