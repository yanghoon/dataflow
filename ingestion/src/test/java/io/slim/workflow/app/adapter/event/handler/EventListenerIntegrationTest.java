package io.slim.workflow.app.adapter.event.handler;

import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

@SpringBootTest(classes = {
    CustomerEventHandler.class,
    EventListenerIntegrationTest.Config.class
})
@ActiveProfiles("test")
class EventListenerIntegrationTest {

    @Autowired
    private ApplicationEventPublisher publisher;

    @MockitoSpyBean
    private CustomerEventHandler customerEventHandler;

    @TestConfiguration
    @EnableTransactionManagement
    static class Config {
        @Bean
        @Primary
        public Map<String, RestClient> restClients() {
            return new HashMap<>();
        }
    }

    @Test
    void testEventRouting() {
        // Arrange
        CloudEvent eventA = CloudEventBuilder.v1()
                .withId("event-1")
                .withSource(URI.create("/test"))
                .withType("customer.suspend.account")
                .withTime(OffsetDateTime.now())
                .build();

        CloudEvent eventB = CloudEventBuilder.v1()
                .withId("event-2")
                .withSource(URI.create("/test"))
                .withType("toolB.test")
                .withTime(OffsetDateTime.now())
                .build();

        // Act
        publisher.publishEvent(eventA);
        publisher.publishEvent(eventB);

        // Assert
        verify(customerEventHandler).handle(eventA);
        verify(customerEventHandler, never()).handle(eventB);
    }
}
