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
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;

public class DormantCustomerPolicy extends AbstractPolicy {

    public DormantCustomerPolicy(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        super(jdbcTemplate, objectMapper, resourceLoader);
    }

    @Override
    public String getType() {
        return "customer-dormant-policy";
    }

    @Override
    public void execute(WorkflowJob jobSnapshot, WorkflowParams params) {
        Map<String, String> props = jobSnapshot.props();
        if (props == null) {
            props = Map.of();
        }
        
        // Use thresholdDays for dynamic interval calculation
        String thresholdDays = props.getOrDefault("thresholdDays", "30");

        MapSqlParameterSource sqlParams = new MapSqlParameterSource();
        sqlParams.addValue("thresholdDays", Integer.parseInt(thresholdDays));
        
        super.extractAndSaveEvents(jobSnapshot, sqlParams, this::toEvent);
    }

    protected record EventId(String naturalKey, String uuid) {
        public static EventId generate(String customerId, String subscriptionDate) {
            String naturalKey = "customer|DormantCustomerPolicy|" + customerId + "|" + subscriptionDate;
            String uuid = UUID.nameUUIDFromBytes(naturalKey.getBytes(StandardCharsets.UTF_8)).toString();
            return new EventId(naturalKey, uuid);
        }
    }

    protected CloudEvent toEvent(ResultSet rs, CloudEventBuilder builder) throws Exception {
        String customerId = rs.getString("customer_id");
        String subscriptionDate = rs.getString("subscription_date");
        String email = rs.getString("email");

        EventId eventId = EventId.generate(customerId, subscriptionDate);

        Map<String, Object> payload = Map.of(
                "customerId", customerId,
                "subscriptionDate", subscriptionDate != null ? subscriptionDate : "",
                "email", email != null ? email : ""
        );

        return builder
                .withSource(java.net.URI.create("urn:dataflow:policy:customer:dormant"))
                .withType("customer.suspend.account")
                .withId(eventId.uuid())
                .withSubject(customerId)
                .withDataContentType("application/json")
                .withData(objectMapper.writeValueAsBytes(payload))
                .build();
    }
}
