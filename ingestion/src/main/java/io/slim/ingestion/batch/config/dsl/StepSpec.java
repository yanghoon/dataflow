package io.slim.ingestion.batch.config.dsl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.SimpleStepBuilder;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.item.ItemReader;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.concurrent.Future;
import java.util.function.Consumer;

public class StepSpec<I, O> {
    private static final Logger log = LoggerFactory.getLogger(StepSpec.class);

    private final StepBuilder stepBuilder;
    private final PlatformTransactionManager txManager;
    private int chunkSize = 10;
    
    private ItemReader<? extends I> reader;
    private ProcessingSpec<I> processingSpec;
    private Mode mode;
    private SimpleStepBuilder<?, ?> builtChunkBuilder;
    private boolean isPagingReader = false;
    private boolean saveStateExplicitlySet = false;
    private boolean saveState = true;

    public StepSpec(String name, JobRepository jobRepository, PlatformTransactionManager txManager) {
        this.stepBuilder = new StepBuilder(name, jobRepository);
        this.txManager = txManager;
    }

    public StepSpec<I, O> chunkSize(int chunkSize) {
        this.chunkSize = chunkSize;
        return this;
    }

    public CursorReaderSpec<I, StepSpec<I, O>> cursorReader() {
        return new CursorReaderSpec<>(this, spec -> {
            this.reader = spec.raw();
        });
    }

    public PagingReaderSpec<I, StepSpec<I, O>> pagingReader() {
        this.isPagingReader = true;
        return new PagingReaderSpec<>(this, spec -> {
            this.reader = spec.raw();
            this.saveStateExplicitlySet = spec.isSaveStateExplicitlySet();
            this.saveState = spec.getSaveState();
        });
    }

    public StepSpec<I, O> sync(Consumer<SyncProcessingSpec<I, O>> specConsumer) {
        if (this.mode != null) {
            throw new IllegalStateException("Mode is already set to " + this.mode);
        }
        this.mode = Mode.SYNC;
        SimpleStepBuilder<I, O> builder = this.stepBuilder.chunk(chunkSize, txManager);
        this.builtChunkBuilder = builder;
        builder.reader(reader);
        SyncProcessingSpec<I, O> spec = new SyncProcessingSpec<>(builder);
        specConsumer.accept(spec);
        this.processingSpec = spec;
        return this;
    }

    public StepSpec<I, O> async(Consumer<AsyncProcessingSpec<I, O>> specConsumer) {
        if (this.mode != null) {
            throw new IllegalStateException("Mode is already set to " + this.mode);
        }
        this.mode = Mode.ASYNC;
        SimpleStepBuilder<I, Future<O>> builder = this.stepBuilder.chunk(chunkSize, txManager);
        this.builtChunkBuilder = builder;
        builder.reader((ItemReader<I>) reader);
        AsyncProcessingSpec<I, O> spec = new AsyncProcessingSpec<>(builder);
        specConsumer.accept(spec);
        this.processingSpec = spec;
        return this;
    }

    public Step build() {
        if (reader == null) {
            throw new IllegalStateException("Reader must be configured");
        }
        if (processingSpec == null) {
            throw new IllegalStateException("ProcessingSpec (sync or async) must be configured");
        }
        if (mode == Mode.ASYNC && isPagingReader) {
            if (!saveStateExplicitlySet || saveState) {
                log.warn("PagingReader is used in ASYNC mode without saveState(false). This can cause concurrency issues!");
            }
        }
        processingSpec.build();
        return this.builtChunkBuilder.build(); // Final build delegating to the chunk builder internally
    }
}
