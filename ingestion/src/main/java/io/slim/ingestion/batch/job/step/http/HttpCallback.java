package io.slim.ingestion.batch.job.step.http;

import org.jspecify.annotations.Nullable;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient.RequestBodySpec;

/**
 * HttpResponseValidator
 */
public interface HttpCallback {

    default @Nullable RepeatStatus call(RequestBodySpec req, ResponseEntity<?> res, ChunkContext chunkContext) throws Exception {
        if (!res.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Fail to request: " + res.getStatusCode());
        }
        return RepeatStatus.FINISHED;
    }

}
