package io.slim.ingestion.batch.job.step.s3;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.job.parameters.JobParameter;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompletedMultipartUpload;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.UploadPartRequest;
import software.amazon.awssdk.services.s3.model.UploadPartResponse;

public class S3UploadTasklet implements Tasklet {

    private static Logger log = LoggerFactory.getLogger(S3UploadTasklet.class);
    
    private final S3Client s3Client;

    public S3UploadTasklet(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    @Override
    public @Nullable RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {
        String stepName = chunkContext.getStepContext().getStepName();
        JobParameters jobParameters = chunkContext.getStepContext().getStepExecution().getJobParameters();

        var raw = jobParameters.parameters().stream().collect(Collectors.toMap(JobParameter::name, JobParameter::value));
        var binder = new Binder(new MapConfigurationPropertySource(raw));

        var sourcePrefix = stepName + ".source";
        var targetPrefix = stepName + ".target";
        var sourceConfig = binder.bind(sourcePrefix, SourceConfig.class).orElseThrow(() -> new IllegalStateException(stepName + ".source 파라미터 누락"));
        var targetConfig = binder.bind(targetPrefix, TargetConfig.class).orElseThrow(() -> new IllegalStateException(stepName + ".target 파라미터 누락"));

        try (var source = SourceStream.Factory.create(sourceConfig)) {
            uploadStreaming(source, targetConfig);
        }

        return RepeatStatus.FINISHED;
    }

    private void uploadStreaming(SourceStream source, TargetConfig target) throws Exception {
        String uploadId = s3Client.createMultipartUpload(
            CreateMultipartUploadRequest.builder()
                .bucket(target.getBucket())
                .key(target.getKey())
                .build()
        ).uploadId();

        List<CompletedPart> completedParts = Collections.synchronizedList(new ArrayList<>());

        // try (var executor = Executors.newVirtualThreadPerTaskExecutor();
        //      InputStream in = source.open()) {
        try (var in = source.open()) {
            var executor = Executors.newFixedThreadPool(5);

            int partSize = target.getPartSizeBytes();
            List<CompletableFuture<Void>> futures = new ArrayList<>();
            int partNumber = 1;
            byte[] buffer = new byte[partSize];
            int read;

            while ((read = in.readNBytes(buffer, 0, partSize)) > 0) {
                byte[] chunk = Arrays.copyOf(buffer, read);
                int currentPartNumber = partNumber++;

                futures.add(CompletableFuture.runAsync(() -> {
                    UploadPartResponse response = s3Client.uploadPart(
                        UploadPartRequest.builder()
                            .bucket(target.getBucket())
                            .key(target.getKey())
                            .uploadId(uploadId)
                            .partNumber(currentPartNumber)
                            .build(),
                        RequestBody.fromBytes(chunk)
                    );
                    completedParts.add(CompletedPart.builder()
                        .partNumber(currentPartNumber)
                        .eTag(response.eTag())
                        .build());
                }, executor));
            }

            CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

        } catch (Exception e) {
            abortSafely(target, uploadId);
            throw e;
        }

        completedParts.sort(Comparator.comparingInt(CompletedPart::partNumber));
        s3Client.completeMultipartUpload(
            CompleteMultipartUploadRequest.builder()
                .bucket(target.getBucket())
                .key(target.getKey())
                .uploadId(uploadId)
                .multipartUpload(CompletedMultipartUpload.builder()
                    .parts(completedParts)
                    .build())
                .build()
        );
    }

    private void abortSafely(TargetConfig target, String uploadId) {
        try {
            s3Client.abortMultipartUpload(
                AbortMultipartUploadRequest.builder()
                    .bucket(target.getBucket())
                    .key(target.getKey())
                    .uploadId(uploadId)
                    .build()
            );
        } catch (Exception abortEx) {
            log.error(
                "Multipart abort 실패 - uploadId={}, bucket={}, key={}",
                uploadId, target.getBucket(), target.getKey(), abortEx);
        }
    }

}
