package io.slim.workflow.app.adapter.event.exception;

import io.slim.workflow.app.adapter.event.model.EventStatus;

public class PermanentFailureException extends DispatchException {
    public PermanentFailureException(String message) {
        super(EventStatus.FAILED, message);
    }
    public PermanentFailureException(String message, Throwable cause) {
        super(EventStatus.FAILED, message, cause);
    }
}
