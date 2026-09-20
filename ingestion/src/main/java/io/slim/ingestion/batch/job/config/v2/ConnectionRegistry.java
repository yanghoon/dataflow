package io.slim.ingestion.batch.job.config.v2;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;
import io.slim.ingestion.batch.job.config.v2.ConnectionSpecs.HttpConnectionSpec;
import io.slim.ingestion.batch.job.config.v2.ConnectionSpecs.S3ConnectionSpec;

// @Data
// @Component
// @ConfigurationProperties(prefix = "connection-registry")
public interface ConnectionRegistry {
    // private Map<String, S3ConnectionInfo> s3;

    HttpConnectionSpec http(String id);
    S3ConnectionSpec s3(String id);

    // public S3ConnectionInfo getS3(String connectionId) {
    //     if (s3 == null || !s3.containsKey(connectionId)) {
    //         throw new IllegalArgumentException("S3 connection not found for id: " + connectionId);
    //     }
    //     return s3.get(connectionId);
    // }

    @RequiredArgsConstructor
    public class DefaultConnectionRegistry implements ConnectionRegistry {
        private final ConnectionProperties props;

        public HttpConnectionSpec http(String id) { return props.http.get(id); }
        public S3ConnectionSpec s3(String id) { return props.s3.get(id); }
    }

    @Setter
    public class ConnectionProperties {
        private Map<String, HttpConnectionSpec> http = new HashMap<>();
        private Map<String, S3ConnectionSpec> s3 = new HashMap<>();
    }
}
