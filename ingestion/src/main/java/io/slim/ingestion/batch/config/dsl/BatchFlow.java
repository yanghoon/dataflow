package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.core.repository.JobRepository;
import org.springframework.transaction.PlatformTransactionManager;

public class BatchFlow {
    public static BatchJobBuilder job(String name, JobRepository jobRepository, PlatformTransactionManager txManager) {
        return new BatchJobBuilder(name, jobRepository, txManager);
    }
}
