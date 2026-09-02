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
public class ToolBEventHandler {

    private final Map<String, RestClient> restClients;

    @EventListener(condition = "#a0.type.startsWith('toolB.')")
    public void handle(CloudEvent event) {
        log.info("[ToolB] Received event: id={}, type={}", event.getId(), event.getType());
        String payload = "";
        if (event.getData() != null) {
            payload = new String(event.getData().toBytes(), StandardCharsets.UTF_8);
            log.debug("[ToolB] Payload: {}", payload);
        }
        
        RestClient restClient = restClients.get("toolB");
        if (restClient != null) {
            restClient.post()
                    .uri("/api/tool-b/events")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[ToolB] Successfully dispatched event to external API.");
        } else {
            log.warn("[ToolB] No RestClient configured for toolB. Skipping external call.");
        }
    }
}
