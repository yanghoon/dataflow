package io.slim.workflow.app.adapter.event.handler;

import io.cloudevents.CloudEvent;
import io.slim.workflow.app.adapter.event.model.EventType;


public interface CloudEventHandler {
    EventType getSupportedType();
    void handle(CloudEvent event);
}
