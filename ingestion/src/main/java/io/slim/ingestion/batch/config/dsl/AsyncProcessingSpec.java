package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.core.step.builder.SimpleStepBuilder;
import org.springframework.batch.integration.async.AsyncItemProcessor;
import org.springframework.batch.integration.async.AsyncItemWriter;
import org.springframework.batch.infrastructure.item.ItemProcessor;
import org.springframework.batch.infrastructure.item.ItemWriter;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;

import java.util.concurrent.Future;

public class AsyncProcessingSpec<I, O> implements ProcessingSpec<I> {
    private final SimpleStepBuilder<I, Future<O>> stepBuilder;
    private ItemProcessor<I, O> delegateProcessor;
    private ItemWriter<O> delegateWriter;
    private TaskExecutor taskExecutor = new SimpleAsyncTaskExecutor("async-batch-");

    public AsyncProcessingSpec(SimpleStepBuilder<I, Future<O>> stepBuilder) {
        this.stepBuilder = stepBuilder;
    }

    public AsyncProcessingSpec<I, O> taskExecutor(TaskExecutor taskExecutor) {
        this.taskExecutor = taskExecutor;
        return this;
    }

    public AsyncProcessingSpec<I, O> processor(ItemProcessor<I, O> delegateProcessor) {
        this.delegateProcessor = delegateProcessor;
        return this;
    }

    public AsyncProcessingSpec<I, O> writer(ItemWriter<O> delegateWriter) {
        this.delegateWriter = delegateWriter;
        return this;
    }

    @Override
    public void build() {
        if (delegateProcessor != null) {
            AsyncItemProcessor<I, O> asyncProcessor = new AsyncItemProcessor<>(delegateProcessor);
            asyncProcessor.setTaskExecutor(taskExecutor);
            stepBuilder.processor(asyncProcessor);
        }
        if (delegateWriter != null) {
            AsyncItemWriter<O> asyncWriter = new AsyncItemWriter<>(delegateWriter);
            stepBuilder.writer(asyncWriter);
        } else {
            throw new IllegalArgumentException("Writer must be provided for ASYNC processing.");
        }
    }
}
