package io.slim.ingestion.batch.v2.app.job.async;

import org.springframework.batch.infrastructure.item.Chunk;
import org.springframework.batch.infrastructure.item.ItemWriter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

public class AsyncCollectingWriter<I, O> implements ItemWriter<Result<I, CompletableFuture<O>>> {
    private final ItemWriter<O> delegateWriter;
    private final ItemWriter<Result<I, Throwable>> failureWriter;
    private volatile int lastFailureCount = 0;

    public AsyncCollectingWriter(ItemWriter<O> delegateWriter, ItemWriter<Result<I, Throwable>> failureWriter) {
        this.delegateWriter = delegateWriter;
        this.failureWriter = failureWriter;
    }

    @Override
    public void write(Chunk<? extends Result<I, CompletableFuture<O>>> chunk) throws Exception {
        List<O> success = new ArrayList<>();
        List<Result<I, Throwable>> failures = new ArrayList<>();

        for (Result<I, CompletableFuture<O>> entry : chunk.getItems()) {
            try {
                success.add(entry.second().join());
            } catch (CompletionException e) {
                // TODO: 재시도 처리는 여기서 구현 (현재는 주석만 남김)
                failures.add(new Result<>(entry.first(), e.getCause()));
            }
        }

        if (!success.isEmpty()) delegateWriter.write(new Chunk<>(success));
        if (!failures.isEmpty()) failureWriter.write(new Chunk<>(failures));

        this.lastFailureCount = failures.size();
    }
    
    public int getLastFailureCount() { return lastFailureCount; }
}
