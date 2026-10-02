package io.slim.batch.console.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.configuration.support.JobRegistrySmartInitializingSingleton;
import org.springframework.batch.core.configuration.support.MapJobRegistry;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.DatabasePopulatorUtils;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import io.slim.batch.console.config.BatchConsoleAutoConfiguration;

@SpringBootTest(classes = BatchConsoleControllerIntegrationTest.TestConfig.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class BatchConsoleControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Configuration
    @EnableWebMvc
    @EnableBatchProcessing
    @Import(BatchConsoleAutoConfiguration.class)
    static class TestConfig {

        @Bean
        public DataSource dataSource() {
            DriverManagerDataSource dataSource = new DriverManagerDataSource();
            dataSource.setDriverClassName("org.sqlite.JDBC");
            dataSource.setUrl("jdbc:sqlite::memory:");
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
            populator.addScript(new ClassPathResource("org/springframework/batch/core/schema-drop-sqlite.sql"));
            populator.addScript(new ClassPathResource("org/springframework/batch/core/schema-sqlite.sql"));
            populator.setIgnoreFailedDrops(true);
            DatabasePopulatorUtils.execute(populator, dataSource);
            return dataSource;
        }

        @Bean
        public PlatformTransactionManager transactionManager(DataSource dataSource) {
            return new JdbcTransactionManager(dataSource);
        }

        @Bean
        public Job testJob(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
            return new JobBuilder("testJob", jobRepository)
                    .start(new StepBuilder("step1", jobRepository)
                            .tasklet((contribution, chunkContext) -> RepeatStatus.FINISHED, transactionManager)
                            .build())
                    .build();
        }
        
        @Bean
        public JobRegistry jobRegistry() {
            return new MapJobRegistry();
        }
        
        @Bean
        public JobRegistrySmartInitializingSingleton jobRegistrySmartInitializingSingleton(JobRegistry jobRegistry) {
            return new JobRegistrySmartInitializingSingleton(jobRegistry) {
                @Override
                public void afterSingletonsInstantiated() {
                    try {
                        super.afterSingletonsInstantiated();
                    } catch (Exception e) {
                        // ignore DuplicateJobException
                    }
                }
            };
        }
    }

    @Test
    public void testLaunchJobIntegration() throws Exception {
        mockMvc.perform(post("/api/batch/jobs/testJob/executions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"param1\": \"value1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executionId").isNumber());
    }
}
