package io.slim.workflow.app.adapter.event.dispatcher;

import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import io.slim.workflow.app.adapter.event.dispatcher.CloudEventDispatcher;
import io.slim.workflow.app.adapter.event.exception.DispatchException;
import io.slim.workflow.app.adapter.event.handler.CloudEventHandler;
import io.slim.workflow.app.adapter.event.model.EventStatus;
import io.slim.workflow.app.adapter.event.model.EventType;


class CloudEventDispatcherTest {

    @Test
    void dispatch_ValidEvent_CallsHandler() {
        CloudEventHandler handler = mock(CloudEventHandler.class);
        when(handler.getSupportedType()).thenReturn(EventType.CUSTOMER_SUSPEND_ACCOUNT);

        CloudEventDispatcher dispatcher = new CloudEventDispatcher(List.of(handler));

        CloudEvent event = CloudEventBuilder.v1()
                .withId("1")
                .withSource(URI.create("/source"))
                .withType("customer.suspend.account")
                .withTime(OffsetDateTime.now())
                .build();

        dispatcher.dispatch(event);

        verify(handler).handle(event);
    }

    @Test
    void dispatch_UnknownType_ThrowsDispatchExceptionFailed() {
        CloudEventDispatcher dispatcher = new CloudEventDispatcher(List.of());

        CloudEvent event = CloudEventBuilder.v1()
                .withId("1")
                .withSource(URI.create("/source"))
                .withType("unknown.type")
                .withTime(OffsetDateTime.now())
                .build();

        assertThatThrownBy(() -> dispatcher.dispatch(event))
                .isInstanceOf(DispatchException.class)
                .extracting("targetStatus")
                .isEqualTo(EventStatus.FAILED);
    }

    @Test
    void dispatch_NoRegisteredHandler_ThrowsDispatchExceptionFailedWithIllegalStateException() {
        CloudEventDispatcher dispatcher = new CloudEventDispatcher(List.of());

        CloudEvent event = CloudEventBuilder.v1()
                .withId("1")
                .withSource(URI.create("/source"))
                .withType("customer.suspend.account")
                .withTime(OffsetDateTime.now())
                .build();

        assertThatThrownBy(() -> dispatcher.dispatch(event))
                .isInstanceOf(DispatchException.class)
                .hasCauseInstanceOf(IllegalStateException.class)
                .extracting("targetStatus")
                .isEqualTo(EventStatus.FAILED);
    }
}
