package io.slim.ingestion.batch.v2.app.config.job;

import io.slim.ingestion.batch.v2.app.job.async.AsyncCollectingWriter;
import io.slim.ingestion.batch.v2.app.job.async.AsyncWrapperProcessor;
import io.slim.ingestion.batch.v2.app.job.async.DormantUser;
import io.slim.ingestion.batch.v2.app.job.async.ExternalApiClient;
import io.slim.ingestion.batch.v2.app.job.async.Result;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.item.ItemProcessor;
import org.springframework.batch.infrastructure.item.ItemWriter;
import org.springframework.batch.infrastructure.item.database.JdbcBatchItemWriter;
import org.springframework.batch.infrastructure.item.database.JdbcCursorItemReader;
import org.springframework.batch.infrastructure.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.batch.infrastructure.item.database.builder.JdbcCursorItemReaderBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class AsyncApiSyncJobConfig {

    public static final String JOB_NAME = "asyncApiSyncJob";
    public static final String STEP_NAME = "asyncApiSyncStep";

    @Bean
    public Job asyncApiSyncJob(JobRepository jobRepository, Step asyncApiSyncStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
                .start(asyncApiSyncStep)
                .build();
    }

    @Bean
    public Step asyncApiSyncStep(
            JobRepository jobRepository,
            PlatformTransactionManager transactionManager,
            JdbcCursorItemReader<DormantUser> dormantUserReader,
            AsyncWrapperProcessor<DormantUser, Long> asyncUserProcessor,
            AsyncCollectingWriter<DormantUser, Long> asyncUserWriter) {

        return new StepBuilder(STEP_NAME, jobRepository)
                .<DormantUser, Result<DormantUser, java.util.concurrent.CompletableFuture<Long>>>chunk(10, transactionManager)
                .reader(dormantUserReader)
                .processor(asyncUserProcessor)
                .writer(asyncUserWriter)
                .build();
    }

    @Bean
    @StepScope
    public JdbcCursorItemReader<DormantUser> dormantUserReader(
            DataSource dataSource,
            @Value("#{jobParameters['run.date']}") String runDateStr) {
        
        LocalDate runDate = LocalDate.parse(runDateStr, DateTimeFormatter.ISO_DATE);
        // 휴면 기준: 1년 전
        LocalDate thresholdDate = runDate.minusYears(1);

        return new JdbcCursorItemReaderBuilder<DormantUser>()
                .name("dormantUserReader")
                .dataSource(dataSource)
                .sql("SELECT id, email, last_login_date FROM users WHERE last_login_date < ?")
                .queryArguments(thresholdDate.toString())
                .rowMapper((rs, rowNum) -> new DormantUser(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("last_login_date")
                ))
                .build();
    }

    @Bean
    public ItemProcessor<DormantUser, Long> syncUserProcessor(ExternalApiClient externalApiClient) {
        return item -> {
            externalApiClient.syncUser(item.id());
            return item.id();
        };
    }

    @Bean
    public AsyncWrapperProcessor<DormantUser, Long> asyncUserProcessor(ItemProcessor<DormantUser, Long> syncUserProcessor) {
        // Virtual Thread Executor
        ExecutorService executorService = Executors.newVirtualThreadPerTaskExecutor();
        return new AsyncWrapperProcessor<>(syncUserProcessor, executorService);
    }

    @Bean
    public JdbcBatchItemWriter<Long> successLogWriter(DataSource dataSource) {
        return new JdbcBatchItemWriterBuilder<Long>()
                .dataSource(dataSource)
                .sql("INSERT INTO success_log (item_key, created_at) VALUES (?, CURRENT_TIMESTAMP)")
                .itemPreparedStatementSetter((item, ps) -> ps.setLong(1, item))
                .build();
    }

    @Bean
    public JdbcBatchItemWriter<Result<DormantUser, Throwable>> failureLogWriter(DataSource dataSource) {
        return new JdbcBatchItemWriterBuilder<Result<DormantUser, Throwable>>()
                .dataSource(dataSource)
                .sql("INSERT INTO failure_log (item_key, error_message, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
                .itemPreparedStatementSetter((item, ps) -> {
                    ps.setLong(1, item.first().id());
                    ps.setString(2, item.second().getMessage());
                })
                .build();
    }

    @Bean
    public AsyncCollectingWriter<DormantUser, Long> asyncUserWriter(
            JdbcBatchItemWriter<Long> successLogWriter,
            JdbcBatchItemWriter<Result<DormantUser, Throwable>> failureLogWriter) {
        return new AsyncCollectingWriter<>(successLogWriter, failureLogWriter);
    }
}
