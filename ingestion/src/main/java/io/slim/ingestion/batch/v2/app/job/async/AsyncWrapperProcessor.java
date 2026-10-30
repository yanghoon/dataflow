package io.slim.ingestion.batch.v2.app.job.async;

import org.springframework.batch.infrastructure.item.ItemProcessor;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;

public class AsyncWrapperProcessor<I, O> implements ItemProcessor<I, Result<I, CompletableFuture<O>>> {
    private final ItemProcessor<I, O> delegate;
    private final ExecutorService executor;

    public AsyncWrapperProcessor(ItemProcessor<I, O> delegate, ExecutorService executor) {
        this.delegate = delegate;
        this.executor = executor;
    }

    @Override
    public Result<I, CompletableFuture<O>> process(I item) {
        CompletableFuture<O> future = CompletableFuture.supplyAsync(() -> {
            try {
                return delegate.process(item);
            } catch (Exception e) {
                throw new CompletionException(e);
            }
        }, executor);
        return new Result<>(item, future);
    }
}
