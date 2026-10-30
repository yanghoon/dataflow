package io.slim.ingestion.batch.job.step.s3.source;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.OptionalLong;

import org.springframework.http.HttpStatus;

import io.slim.ingestion.batch.job.step.s3.SourceConfig;
import io.slim.ingestion.batch.job.step.s3.SourceStream;

public class HttpSourceStreamV2 implements SourceStream {

    private final SourceConfig config;
    // private BiFunction<SourceConfig, HttpURLConnection, Boolean> vaildator;
    private HttpResponseValidator validator;
    private HttpURLConnection conn;

    public HttpSourceStreamV2(
        SourceConfig config,
        // BiFunction<SourceConfig, HttpURLConnection, Boolean> vaildator
        HttpResponseValidator validator
    ) {
        this.config = config;
        this.validator = validator;

        if (validator == null) {
            this.validator = (conf, conn) -> {
                var status = HttpStatus.valueOf(conn.getResponseCode());
                return status.is2xxSuccessful();
            };
        };
    }

    @Override
    public InputStream open() throws Exception {
        var url = URI.create(config.getUrl()).toURL();
        this.conn = (HttpURLConnection) url.openConnection();
        
        conn.setRequestMethod(config.getMethod());
        config.getHeaders().forEach(conn::setRequestProperty);

        if (!validator.validate(config, conn)) {
            var status = HttpStatus.valueOf(conn.getResponseCode());
            throw new IOException("Fail to http request: status=" + status + ", url=" + config.getUrl());
        }

        return conn.getInputStream();
    }

    @Override
    public OptionalLong contentLength() {
        if (conn == null)
            return OptionalLong.empty();
        return OptionalLong.of(conn.getContentLength());
    }

    @Override
    public void close() throws Exception {
        if (conn != null)
            conn.disconnect();
    }
    
}
