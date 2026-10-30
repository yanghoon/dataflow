package io.slim.ingestion.batch.v2.app.job.async;

public interface ExternalApiClient {
    void syncUser(Long userId);
}
