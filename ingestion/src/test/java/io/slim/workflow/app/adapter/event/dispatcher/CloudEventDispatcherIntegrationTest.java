package io.slim.workflow.app.adapter.event.dispatcher;

import io.cloudevents.CloudEvent;
import io.cloudevents.core.builder.CloudEventBuilder;
import io.slim.workflow.app.adapter.event.handler.CustomerEventHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import io.slim.workflow.app.adapter.event.dispatcher.CloudEventDispatcher;
import io.slim.workflow.app.adapter.event.handler.CustomerEventHandler;


@SpringBootTest(properties = {
    "spring.sql.init.schemaLocations=classpath:sql/schema/outbox_event.sql"
})
@Testcontainers
@ActiveProfiles("outbox")
class CloudEventDispatcherIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @Autowired
    private CloudEventDispatcher dispatcher;

    @MockitoSpyBean
    private CustomerEventHandler customerEventHandler;

    @Test
    void testDispatcherRoutesToBean() {
        CloudEvent event = CloudEventBuilder.v1()
                .withId("1")
                .withSource(URI.create("/source"))
                .withType("customer.suspend.account")
                .withTime(OffsetDateTime.now())
                .build();

        dispatcher.dispatch(event);

        verify(customerEventHandler).handle(any(CloudEvent.class));
    }
}
