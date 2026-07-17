package io.slim.ingestion.batch.infra.rest.job;

import java.net.URL;
import java.util.Map;

import org.springframework.http.HttpMethod;

public record HttpRequestSpec(
    URL url,
    HttpMethod method,
    Map<String, String> headers,
    String body
) {}
