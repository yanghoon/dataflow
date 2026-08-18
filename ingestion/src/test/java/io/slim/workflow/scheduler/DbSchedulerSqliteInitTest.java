package io.slim.workflow.scheduler;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.Connection;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

public class DbSchedulerSqliteInitTest {

    @Test
    public void testSqliteSchemaInitialization() {
        assertDoesNotThrow(() -> {
            DriverManagerDataSource dataSource = new DriverManagerDataSource();
            dataSource.setDriverClassName("org.sqlite.JDBC");
            dataSource.setUrl("jdbc:sqlite::memory:");

            try (Connection connection = dataSource.getConnection()) {
                ClassPathResource resource = new ClassPathResource("sql/schema/db_scheduler_sqlite.sql");
                ScriptUtils.executeSqlScript(connection, resource);
            }
        });
    }
}
