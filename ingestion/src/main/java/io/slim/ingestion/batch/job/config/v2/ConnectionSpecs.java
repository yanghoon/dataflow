package io.slim.ingestion.batch.job.config.v2;

import lombok.Data;

public class ConnectionSpecs {

    @Data
    public static class HttpConnectionSpec {
        private String baseUrl;
        private String authEnvVar;
    }

    @Data
    public static class S3ConnectionSpec {
        private String endpoint;
        private String region;
    }

}