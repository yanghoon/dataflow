package io.slim.workflow.app.adapter.event.exception;

import lombok.Getter;
import io.slim.workflow.app.adapter.event.model.EventStatus;


@Getter
public class DispatchException extends RuntimeException {
    private final EventStatus targetStatus;

    public DispatchException(EventStatus targetStatus, String message) {
        super(message);
        this.targetStatus = targetStatus;
    }

    public DispatchException(EventStatus targetStatus, String message, Throwable cause) {
        super(message, cause);
        this.targetStatus = targetStatus;
    }
}
