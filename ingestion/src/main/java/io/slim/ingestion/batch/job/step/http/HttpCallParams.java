package io.slim.ingestion.batch.job.step.http;

@Getter
@Builder
public class HttpCallParams {
    String url;
    String method;
    Map<String, String> haeders;
    long regryCount;
    long retryIntervalMs;
    long timeoutMs;
} 