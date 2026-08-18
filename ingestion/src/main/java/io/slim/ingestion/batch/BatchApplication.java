package io.slim.ingestion.batch;

import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestClient;

// @SpringBootApplication(scanBasePackages = "io.slim")
// @ConfigurationPropertiesScan(basePackages = "io.slim")
public class BatchApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(BatchApplication.class, args);
    }

    @Bean
    public RestClient restClient() {
        return RestClient.create();
    }

    @Bean
    public javax.sql.DataSource dataSource(org.springframework.core.env.Environment env) {
        com.zaxxer.hikari.HikariDataSource ds = new com.zaxxer.hikari.HikariDataSource();
        ds.setJdbcUrl(env.getProperty("spring.datasource.url"));
        ds.setDriverClassName(env.getProperty("spring.datasource.driverClassName"));
        ds.setUsername(env.getProperty("spring.datasource.username"));
        ds.setPassword(env.getProperty("spring.datasource.password"));
        return ds;
    }

    // @Bean
    // public BuildInfo buildInfo(
    //         @Autowired(required = false) org.springframework.boot.info.GitProperties gitProperties,
    //         @Autowired(required = false) org.springframework.boot.info.BuildProperties buildProperties) {
    //     if (gitProperties != null && gitProperties.getCommitTime() != null && buildProperties != null) {
    //         return BuildInfo.current(gitProperties, buildProperties);
    //     }
    //     return new BuildInfo(System.currentTimeMillis(), "dev", "1.0.0");
    // }
}
