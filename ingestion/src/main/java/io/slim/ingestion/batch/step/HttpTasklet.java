package io.slim.ingestion.batch.step;

import java.util.Map;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.ObjectMapper;

public class HttpTasklet implements Tasklet {
    private static Logger log = LoggerFactory.getLogger(HttpTasklet.class);
    private static RestClient restClient = RestClient.create();
    private static ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public @Nullable RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {

        var jobParameters = chunkContext.getStepContext().getJobParameters();
        // String pipelineId = (String) jobParameters.get("pipelineId");
        var stepName = chunkContext.getStepContext().getStepName();

        // 3. Pipeline ID와 Step 이름으로 현재 스텝에 딱 맞는 옵션(설정)을 실시간 로드
        // (Trino/Flink의 WITH 절을 런타임에 해석하는 것과 동일한 원리)
        var opts = new HttpOptions(jobParameters);

        // log.info("Executing Step [{}] - Requesting API: [{}] {}", stepName, options.httpMethod(), options.apiUrl());

        // 4. HTTP 요청 조립 및 실행
        HttpMethod method = HttpMethod.valueOf(opts.httpMethod());
        RestClient.RequestBodySpec requestSpec = restClient.method(method).uri(opts.apiUrl());

        if (opts.headers() != null && !opts.headers().isEmpty()) {
            requestSpec.headers(h -> opts.headers().forEach(h::add));
        }

        if (opts.requestBody() != null && (method == HttpMethod.POST || method == HttpMethod.PUT)) {
            requestSpec.body(opts.requestBody());
        }

        ResponseEntity<String> responseEntity = requestSpec.retrieve().toEntity(String.class);

        if (!responseEntity.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("API 호출 실패: " + responseEntity.getStatusCode());
        }

        // 5. 동적 키를 사용하여 다음 Step을 위해 결과 저장
        chunkContext.getStepContext()
                .getStepExecution()
                .getJobExecution()
                .getExecutionContext()
                .putString(opts.resultContextKey(), responseEntity.getBody());

        return RepeatStatus.FINISHED;
    }

    record HttpOptions(Map<String, Object> map){
        String apiUrl() { return String.valueOf(map.get("apiUrl")); }
        String httpMethod() { return String.valueOf(map.get("httpMethod")); }
        String requestBody() { return String.valueOf(map.get("requestBody")); }
        String resultContextKey() { return String.valueOf(map.get("resultContextKey")); }
        Map<String, String> headers() { return (Map<String, String>) map.get("headers"); }
    };

}
