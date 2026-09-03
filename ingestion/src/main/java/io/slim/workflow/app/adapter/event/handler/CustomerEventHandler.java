package io.slim.workflow.app.adapter.event.handler;

import io.cloudevents.CloudEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Slf4j
@RequiredArgsConstructor
@Component
public class CustomerEventHandler {

    @EventListener(condition = "#a0.type.startsWith('customer.')")
    public void handle(CloudEvent event) {
        log.info("[Customer] Received event: id={}, type={}", event.getId(), event.getType());
        String payload = "";
        if (event.getData() != null) {
            payload = new String(event.getData().toBytes(), StandardCharsets.UTF_8);
            log.debug("[Customer] Payload: {}", payload);
        }
        
        // TODO: Implement actual suspension logic
        log.info("[Customer] Successfully processed customer dormant event.");
    }
}
