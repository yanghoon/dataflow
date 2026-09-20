package io.slim.workflow.app.adapter.event.model;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import io.slim.workflow.app.adapter.event.exception.UnknownEventTypeException;
import io.slim.workflow.app.adapter.event.model.EventType;


class EventTypeTest {

    @Test
    void from_ValidType_ReturnsEnum() {
        EventType type = EventType.from("customer.suspend.account");
        assertThat(type).isEqualTo(EventType.CUSTOMER_SUSPEND_ACCOUNT);
    }

    @Test
    void from_InvalidType_ThrowsUnknownEventTypeException() {
        assertThatThrownBy(() -> EventType.from("invalid.type"))
                .isInstanceOf(UnknownEventTypeException.class)
                .hasMessageContaining("Unknown event type: invalid.type");
    }
}
