package io.slim.workflow.app.adapter.event.dispatcher;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import io.slim.workflow.app.adapter.event.handler.CloudEventHandler;
import io.slim.workflow.app.adapter.event.model.EventType;


@Slf4j
@Component
@RequiredArgsConstructor
public class EventHandlerCoverageValidator {

    private final List<CloudEventHandler> handlers;

    @PostConstruct
    public void validate() {
        Set<EventType> registeredTypes = handlers.stream()
                .map(CloudEventHandler::getSupportedType)
                .collect(Collectors.toSet());

        List<EventType> missingTypes = Arrays.stream(EventType.values())
                .filter(type -> !registeredTypes.contains(type))
                .toList();

        if (!missingTypes.isEmpty()) {
            throw new IllegalStateException("Missing handlers for EventTypes: " + missingTypes);
        }
        log.info("All {} EventTypes have registered handlers.", EventType.values().length);
    }
}
