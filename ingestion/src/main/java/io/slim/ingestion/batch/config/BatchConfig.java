package io.slim.ingestion.batch.config;

import org.springframework.context.annotation.Configuration;

@Configuration
// @EnableJdbcJobRepository
public class BatchConfig {
    
    // @Bean
    // public JobRegistryBeanPostProcessor jobRegistryBeanPostProcessor(JobRegistry jobRegistry) {
    //     JobRegistryBeanPostProcessor postProcessor = new JobRegistryBeanPostProcessor();
    //     // 애플리케이션에 띄워진 모든 Job 빈을 스캔해서 JobRegistry에 이름을 등록함
    //     postProcessor.setJobRegistry(jobRegistry);
    //     return postProcessor;
    // }

    // @Bean
    // public JobOperatorFactoryBean jobOperator(JobRepository jobRepository) {
    //     JobOperatorFactoryBean jobOperatorFactoryBean = new JobOperatorFactoryBean();
    //     jobOperatorFactoryBean.setJobRepository(jobRepository);
    //     return jobOperatorFactoryBean;
    // }

}
