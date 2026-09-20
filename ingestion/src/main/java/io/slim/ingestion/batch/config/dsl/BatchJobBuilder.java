package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.job.builder.SimpleJobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.function.Consumer;

public class BatchJobBuilder {
    private final JobBuilder jobBuilder;
    private final JobRepository jobRepository;
    private final PlatformTransactionManager txManager;
    private SimpleJobBuilder simpleJobBuilder;

    public BatchJobBuilder(String name, JobRepository jobRepository, PlatformTransactionManager txManager) {
        this.jobBuilder = new JobBuilder(name, jobRepository);
        this.jobRepository = jobRepository;
        this.txManager = txManager;
    }

    public <I, O> BatchJobBuilder start(String stepName, Consumer<StepSpec<I, O>> stepConfigurer) {
        return start(stepName, this.txManager, stepConfigurer);
    }

    public <I, O> BatchJobBuilder start(String stepName, PlatformTransactionManager customTxManager, Consumer<StepSpec<I, O>> stepConfigurer) {
        if (customTxManager == null) throw new IllegalArgumentException("PlatformTransactionManager is required.");
        StepSpec<I, O> stepSpec = new StepSpec<>(stepName, jobRepository, customTxManager);
        stepConfigurer.accept(stepSpec);
        this.simpleJobBuilder = this.jobBuilder.start(stepSpec.build());
        return this;
    }

    public <I, O> BatchJobBuilder next(String stepName, Consumer<StepSpec<I, O>> stepConfigurer) {
        return next(stepName, this.txManager, stepConfigurer);
    }

    public <I, O> BatchJobBuilder next(String stepName, PlatformTransactionManager customTxManager, Consumer<StepSpec<I, O>> stepConfigurer) {
        if (customTxManager == null) throw new IllegalArgumentException("PlatformTransactionManager is required.");
        StepSpec<I, O> stepSpec = new StepSpec<>(stepName, jobRepository, customTxManager);
        stepConfigurer.accept(stepSpec);
        this.simpleJobBuilder.next(stepSpec.build());
        return this;
    }

    public Job build() { return this.simpleJobBuilder.build(); }
}
