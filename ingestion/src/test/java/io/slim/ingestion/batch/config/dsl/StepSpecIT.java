package io.slim.ingestion.batch.config.dsl;

import org.junit.jupiter.api.Test;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = {io.slim.ingestion.batch.TestApplication.class, StepSpecIT.TestConfig.class}, properties = {"spring.batch.job.enabled=false"})
public class StepSpecIT {

    @Autowired
    private ApplicationContext context;

    @Test
    void shouldRegisterJobBean() {
        Job job = context.getBean("testJob", Job.class);
        assertThat(job).isNotNull();
        assertThat(job.getName()).isEqualTo("testJob");
    }

    @Configuration
    static class TestConfig {
        @Bean
        public io.slim.ingestion.batch.job.config.v2.ConnectionRegistry connectionRegistry() { 
            return org.mockito.Mockito.mock(io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.class); 
        }
        
        @Bean
        public org.springframework.batch.core.configuration.JobRegistry jobRegistry() { 
            return new org.springframework.batch.core.configuration.support.MapJobRegistry(); 
        }

        @Bean
        public Job testJob(JobRepository jobRepository, PlatformTransactionManager txManager, DataSource dataSource) {
            return BatchFlow.job("testJob", jobRepository, txManager)
                    .<String, String>start("testStep", step -> step
                            .chunkSize(10)
                            .cursorReader()
                                .name("dummyReader")
                                .dataSource(dataSource)
                                .sql("SELECT 1")
                                .rowMapper((rs, i) -> "dummy")
                                .and()
                            .sync(sync -> sync
                                    .processor(item -> item)
                                    .writer(chunk -> {})
                            )
                    )
                    .build();
        }
    }
}
