package io.slim.workflow.app.adapter.event;

import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JdbcEventMessagePollerTest {

    @Mock
    private EventCandidateRepository repository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private JdbcEventMessagePoller poller;

    private static final String EXTRACT_SQL = "SELECT ...";
    private static final String UPDATE_SQL = "UPDATE ...";

    @BeforeEach
    void setUp() {
        poller = new JdbcEventMessagePoller(
                repository,
                eventPublisher,
                EXTRACT_SQL,
                UPDATE_SQL,
                "TestPoller",
                3,
                100L
        );
    }

    @Test
    void testPermanentFailure() {
        CloudEvent event = CloudEventBuilder.v1()
                .withId("event-1")
                .withSource(URI.create("/test"))
                .withType("test.type")
                .withTime(OffsetDateTime.now())
                .build();

        when(repository.findCandidates(EXTRACT_SQL)).thenReturn(List.of(event));
        doThrow(new PermanentFailureException("fatal")).when(eventPublisher).publishEvent(any(Object.class));

        poller.pollAndDispatch();

        verify(repository).updateStatusToFailed(List.of("event-1"));
        verify(repository, never()).updateStatusToDone(anyString(), anyList());
        verify(repository, never()).updateRetry(anyString(), anyInt(), anyString());
    }

    @Test
    void testRetryableFailure() {
        CloudEvent event = CloudEventBuilder.v1()
                .withId("event-2")
                .withSource(URI.create("/test"))
                .withType("test.type")
                .withTime(OffsetDateTime.now())
                .build();

        when(repository.findCandidates(EXTRACT_SQL)).thenReturn(List.of(event));
        doThrow(new RestClientException("timeout")).when(eventPublisher).publishEvent(any(Object.class));

        poller.pollAndDispatch();

        verify(repository).updateRetry(eq("event-2"), eq(1), anyString());
        verify(repository, never()).updateStatusToFailed(anyList());
        verify(repository, never()).updateStatusToDone(anyString(), anyList());
    }

    @Test
    void testMaxAttemptsReached() {
        CloudEvent event = CloudEventBuilder.v1()
                .withId("event-3")
                .withSource(URI.create("/test"))
                .withType("test.type")
                .withExtension("retrycount", 2)
                .withTime(OffsetDateTime.now())
                .build();

        when(repository.findCandidates(EXTRACT_SQL)).thenReturn(List.of(event));
        doThrow(new RestClientException("timeout")).when(eventPublisher).publishEvent(any(Object.class));

        poller.pollAndDispatch();

        verify(repository).updateStatusToFailed(List.of("event-3"));
        verify(repository, never()).updateRetry(anyString(), anyInt(), anyString());
        verify(repository, never()).updateStatusToDone(anyString(), anyList());
    }
    
    @Test
    void testSuccess() {
        CloudEvent event = CloudEventBuilder.v1()
                .withId("event-4")
                .withSource(URI.create("/test"))
                .withType("test.type")
                .withTime(OffsetDateTime.now())
                .build();

        when(repository.findCandidates(EXTRACT_SQL)).thenReturn(List.of(event));

        poller.pollAndDispatch();

        verify(repository).updateStatusToDone(eq(UPDATE_SQL), eq(List.of("event-4")));
        verify(repository, never()).updateStatusToFailed(anyList());
        verify(repository, never()).updateRetry(anyString(), anyInt(), anyString());
    }
}
