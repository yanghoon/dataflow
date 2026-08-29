package io.slim.workflow.app.adapter.event.handler;

import io.cloudevents.CloudEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Slf4j
@Component
public class ToolBEventHandler {

    @EventListener(condition = "#event.type.startsWith('toolB.')")
    public void handle(CloudEvent event) {
        log.info("[ToolB] Received event: id={}, type={}", event.getId(), event.getType());
        if (event.getData() != null) {
            String payload = new String(event.getData().toBytes(), StandardCharsets.UTF_8);
            log.debug("[ToolB] Payload: {}", payload);
        }
        // TODO: Call Tool B external API or DB logic
    }
}
