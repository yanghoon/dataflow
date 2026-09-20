package io.slim.workflow.app.job;

import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.batch.autoconfigure.BatchAutoConfiguration;
import org.springframework.boot.batch.jdbc.autoconfigure.BatchJdbcAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceInitializationAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.JdbcTemplateAutoConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

@SpringBatchTest
@ImportAutoConfiguration({
    DataSourceAutoConfiguration.class,
    DataSourceTransactionManagerAutoConfiguration.class,
    BatchAutoConfiguration.class,
    BatchJdbcAutoConfiguration.class
})
// @ImportAutoConfiguration({
//     DataSourceInitializationAutoConfiguration.class,
//     JdbcTemplateAutoConfiguration.class
// })
// @TestPropertySource(properties = {
//     "xxx=yyy",
// })
// @SpringJUnitConfig(YourJobConfig.class)
public @interface SpringBatchSliceTest {
    
}
