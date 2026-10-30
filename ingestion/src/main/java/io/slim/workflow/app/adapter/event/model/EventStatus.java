package io.slim.workflow.app.adapter.event.model;

public enum EventStatus {
    PENDING,
    PROCESSING,
    SENT,
    CONFIRMED,
    RETRY_PENDING,
    FAILED,
    CANCELLED
}
