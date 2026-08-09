package io.slim.ingestion.batch.job.step.http;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestClient;

public class HttpTasklet implements Tasklet {

    public interface Constants {
        String HTTP_URL = "http.url";
        String HTTP_METHOD = "http.method";
        String HTTP_HEADERS = "http.headers";
        String HTTP_BODY = "http.body";
        String HTTP_RESULT = "http.result";
    }

    private static Logger log = LoggerFactory.getLogger(HttpTasklet.class);
    private static RestClient restClient = RestClient.create();
    // private static ObjectMapper objectMapper = new ObjectMapper();

    private HttpCallback callback = new HttpCallback() {};

    public HttpTasklet setCallback(HttpCallback callback) {
        this.callback = callback;
        return this;
    }

    @Override
    public @Nullable RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {

        // Extract Params
        // var jobParams = chunkContext.getStepContext().getJobParameters();
        // var urlStr = jobParams.getOrDefault(Constants.HTTP_URL, "").toString();
        // var methodStr = jobParams.getOrDefault(Constants.HTTP_METHOD, "GET").toString();
        // var headers = jobParams.get(Constants.HTTP_HEADERS);
        // var body = jobParams.get(Constants.HTTP_BODY);

        var step = chunkContext.getStepContext();
        var prefix = step.getStepName();
        var params = StepParamsBinder.bind(step.getJobParameters(), prefix, HttpCallParams.class).get();

        // Build Request
        var method = HttpMethod.valueOf(methodStr);
        var req = restClient.method(method).uri(urlStr);

        if (headers != null) {
            // TODO
        }

        if (body != null) {
            req.body(body);
        }

        // Send Request
        // var res = req.retrieve().toEntity(String.class);
        var res = req.retrieve();

        return callback.call(req, res, chunkContext);

        // Save Result
        // log.info("res : {}", res);
        // chunkContext.getStepContext()
        //         .getStepExecution()
        //         .getJobExecution()
        //         .getExecutionContext()
        //         .putString(Constants.HTTP_RESULT, res.getBody());

        // return RepeatStatus.FINISHED;
    }

}
