package io.slim.ingestion.batch.job.step.s3.source;

import java.net.HttpURLConnection;

import io.slim.ingestion.batch.job.step.s3.SourceConfig;

/**
 * HttpResponseValidator
 */
@FunctionalInterface
public interface HttpResponseValidator {

    boolean validate(SourceConfig config, HttpURLConnection conn) throws Exception;

}
