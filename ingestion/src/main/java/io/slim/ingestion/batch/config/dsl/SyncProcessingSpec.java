package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.core.step.builder.SimpleStepBuilder;
import org.springframework.batch.infrastructure.item.ItemProcessor;
import org.springframework.batch.infrastructure.item.ItemWriter;

public class SyncProcessingSpec<I, O> implements ProcessingSpec<I> {
    private final SimpleStepBuilder<I, O> stepBuilder;
    private ItemProcessor<I, O> processor;
    private ItemWriter<O> writer;

    public SyncProcessingSpec(SimpleStepBuilder<I, O> stepBuilder) {
        this.stepBuilder = stepBuilder;
    }

    public SyncProcessingSpec<I, O> processor(ItemProcessor<I, O> processor) {
        this.processor = processor;
        return this;
    }

    public SyncProcessingSpec<I, O> writer(ItemWriter<O> writer) {
        this.writer = writer;
        return this;
    }

    @Override
    public void build() {
        if (processor != null) {
            stepBuilder.processor(processor);
        }
        if (writer != null) {
            stepBuilder.writer(writer);
        } else {
            throw new IllegalArgumentException("Writer must be provided for SYNC processing.");
        }
    }
}
