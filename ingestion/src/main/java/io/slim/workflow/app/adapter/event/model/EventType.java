package io.slim.workflow.app.adapter.event.model;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import io.slim.workflow.app.adapter.event.exception.UnknownEventTypeException;


public enum EventType {
    CUSTOMER_SUSPEND_ACCOUNT("customer.suspend.account");

    private final String value;

    EventType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    private static final Map<String, EventType> BY_VALUE = Arrays.stream(values())
            .collect(Collectors.toMap(EventType::getValue, Function.identity()));

    public static EventType from(String value) {
        EventType type = BY_VALUE.get(value);
        if (type == null) {
            throw new UnknownEventTypeException("Unknown event type: " + value);
        }
        return type;
    }
}
