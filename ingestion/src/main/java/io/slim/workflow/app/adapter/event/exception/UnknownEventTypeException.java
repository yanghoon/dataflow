package io.slim.workflow.app.adapter.event.exception;

import io.slim.workflow.app.adapter.event.model.EventStatus;

public class UnknownEventTypeException extends DispatchException {
    public UnknownEventTypeException(String message) {
        super(EventStatus.FAILED, message);
    }
}
