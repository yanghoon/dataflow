package io.slim.ingestion.batch.job.config.v2;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "connection-registry")
public class ConnectionRegistry {
    private Map<String, S3ConnectionInfo> s3;

    public S3ConnectionInfo getS3(String connectionId) {
        if (s3 == null || !s3.containsKey(connectionId)) {
            throw new IllegalArgumentException("S3 connection not found for id: " + connectionId);
        }
        return s3.get(connectionId);
    }
}
