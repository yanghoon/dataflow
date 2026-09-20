package io.slim.workflow.app.adapter.event.dispatcher;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import io.slim.workflow.app.adapter.event.dispatcher.EventHandlerCoverageValidator;


@SpringBootTest(properties = {
    "spring.sql.init.schemaLocations=classpath:sql/schema/outbox_event.sql"
})
@Testcontainers
@ActiveProfiles("outbox")
class EventHandlerCoverageValidatorIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @Test
    void contextLoads() {
        // The fact that context loads successfully means that EventHandlerCoverageValidator
        // did not throw an IllegalStateException in @PostConstruct.
    }
}
