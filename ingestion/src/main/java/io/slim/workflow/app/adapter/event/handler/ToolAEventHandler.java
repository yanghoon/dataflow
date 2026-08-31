package io.slim.workflow.app.adapter.event.handler;

import io.cloudevents.CloudEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@RequiredArgsConstructor
@Component
public class ToolAEventHandler {

    private final Map<String, RestClient> restClients;

    @EventListener(condition = "#event.type.startsWith('toolA.')")
    public void handle(CloudEvent event) {
        log.info("[ToolA] Received event: id={}, type={}", event.getId(), event.getType());
        String payload = "";
        if (event.getData() != null) {
            payload = new String(event.getData().toBytes(), StandardCharsets.UTF_8);
            log.debug("[ToolA] Payload: {}", payload);
        }
        
        RestClient restClient = restClients.get("toolA");
        if (restClient != null) {
            restClient.post()
                    .uri("/api/tool-a/events")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[ToolA] Successfully dispatched event to external API.");
        } else {
            log.warn("[ToolA] No RestClient configured for toolA. Skipping external call.");
        }
    }
}
