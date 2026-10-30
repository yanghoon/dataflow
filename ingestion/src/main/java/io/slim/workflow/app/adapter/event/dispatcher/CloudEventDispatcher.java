package io.slim.workflow.app.adapter.event.dispatcher;

import io.cloudevents.CloudEvent;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import io.slim.workflow.app.adapter.event.exception.DispatchException;
import io.slim.workflow.app.adapter.event.exception.UnknownEventTypeException;
import io.slim.workflow.app.adapter.event.handler.CloudEventHandler;
import io.slim.workflow.app.adapter.event.model.EventStatus;
import io.slim.workflow.app.adapter.event.model.EventType;


@Component
public class CloudEventDispatcher {

    private final Map<EventType, CloudEventHandler> handlers;

    public CloudEventDispatcher(List<CloudEventHandler> handlerList) {
        this.handlers = handlerList.stream()
                .collect(Collectors.toUnmodifiableMap(
                        CloudEventHandler::getSupportedType,
                        Function.identity()
                ));
    }

    public void dispatch(CloudEvent event) {
        EventType type;
        try {
            type = EventType.from(event.getType());
        } catch (UnknownEventTypeException e) {
            throw new DispatchException(EventStatus.FAILED, e.getMessage(), e);
        }

        CloudEventHandler handler = handlers.get(type);
        if (handler == null) {
            IllegalStateException cause = new IllegalStateException("Handler not found for type: " + type);
            throw new DispatchException(EventStatus.FAILED, cause.getMessage(), cause);
        }

        try {
            handler.handle(event);
        } catch (DispatchException e) {
            throw e;
        } catch (Exception e) {
            throw new DispatchException(EventStatus.RETRY_PENDING, "Unhandled exception during event processing", e);
        }
    }
}
