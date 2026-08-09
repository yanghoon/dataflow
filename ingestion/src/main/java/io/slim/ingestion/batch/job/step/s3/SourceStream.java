package io.slim.ingestion.batch.job.step.s3;

import java.io.InputStream;
import java.util.OptionalLong;

import io.slim.ingestion.batch.job.step.s3.source.HttpSourceStream;

public interface SourceStream extends AutoCloseable {
    
    InputStream open() throws Exception;
    OptionalLong contentLength();

    public class Factory {
        public static SourceStream create(SourceConfig config) {
            return switch(config.type) {
                case "http" -> new HttpSourceStream(config, null);
                default -> throw new IllegalArgumentException("Unsupported source type '" + config.type + "'");
            };
        }
    }

}
