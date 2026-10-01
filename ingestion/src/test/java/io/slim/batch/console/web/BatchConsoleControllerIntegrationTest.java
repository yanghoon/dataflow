package io.slim.batch.console.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
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
        public javax.sql.DataSource dataSource() {
            org.springframework.jdbc.datasource.DriverManagerDataSource dataSource = new org.springframework.jdbc.datasource.DriverManagerDataSource();
            dataSource.setDriverClassName("org.sqlite.JDBC");
            dataSource.setUrl("jdbc:sqlite::memory:");
            org.springframework.jdbc.datasource.init.ResourceDatabasePopulator populator = new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator();
            populator.addScript(new org.springframework.core.io.ClassPathResource("org/springframework/batch/core/schema-drop-sqlite.sql"));
            populator.addScript(new org.springframework.core.io.ClassPathResource("org/springframework/batch/core/schema-sqlite.sql"));
            populator.setIgnoreFailedDrops(true);
            org.springframework.jdbc.datasource.init.DatabasePopulatorUtils.execute(populator, dataSource);
            return dataSource;
        }

        @Bean
        public PlatformTransactionManager transactionManager(javax.sql.DataSource dataSource) {
            return new org.springframework.jdbc.support.JdbcTransactionManager(dataSource);
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
        public org.springframework.batch.core.configuration.JobRegistry jobRegistry() {
            return new org.springframework.batch.core.configuration.support.MapJobRegistry();
        }
        
        @Bean
        public org.springframework.batch.core.configuration.support.JobRegistrySmartInitializingSingleton jobRegistrySmartInitializingSingleton(org.springframework.batch.core.configuration.JobRegistry jobRegistry) {
            return new org.springframework.batch.core.configuration.support.JobRegistrySmartInitializingSingleton(jobRegistry) {
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
