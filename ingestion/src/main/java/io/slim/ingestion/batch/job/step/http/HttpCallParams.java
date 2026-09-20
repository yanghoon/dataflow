package io.slim.ingestion.batch.job.step.http;

import lombok.Getter;
import lombok.Builder;
import java.util.Map;
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