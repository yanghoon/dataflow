package io.slim.ingestion.batch.v2.app.job.async;

public record Result<T1, T2>(T1 first, T2 second) {
    public boolean isError() {
        return second instanceof Throwable;
    }
}
