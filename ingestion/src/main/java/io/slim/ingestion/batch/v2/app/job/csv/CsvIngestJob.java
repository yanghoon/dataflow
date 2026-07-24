package io.slim.ingestion.batch.v2.app.job.csv;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import javax.sql.DataSource;

import org.postgresql.PGConnection;
import org.postgresql.copy.CopyManager;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.util.FileCopyUtils;
import org.springframework.web.client.RestClient;

import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@RequiredArgsConstructor
public class CsvIngestJob {

    private final CsvIngestJobSpec jobSpec;
    private final RestClient restClient;
    private final S3Client s3Client;
    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;

    public Job buildJob() {
        Step step1 = new StepBuilder(jobSpec.name() + "_headCheckStep", jobRepository)
                .tasklet(
                    new HeadCheckTasklet(restClient, jobSpec.source(), jobSpec.retryInterval() ),
                    transactionManager)
                .build();

        Step step2 = new StepBuilder(jobSpec.name() + "_s3UploadStep", jobRepository)
                .tasklet(new S3UploadTasklet(restClient, s3Client, jobSpec.source(), jobSpec.s3().bucket()), transactionManager)
                .build();

        Step step3 = new StepBuilder(jobSpec.name() + "_postgresCopyStep", jobRepository)
                .tasklet(new PostgresCopyTasklet(s3Client, jobSpec.s3().bucket(), dataSource, jobSpec.copySql(), jobSpec.insertSql()), transactionManager)
                .build();

        return new JobBuilder(jobSpec.name(), jobRepository)
                .start(step1)
                .next(step2)
                .next(step3)
                .build();
    }

    @RequiredArgsConstructor
    public static class HeadCheckTasklet implements Tasklet {
        private final RestClient restClient;
        private final String sourceUrl;
        private final long retryInterval;

        @Override
        public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {
            var response = restClient.head().uri(sourceUrl).retrieve().toBodilessEntity();
            
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new IllegalStateException("HEAD 요청 실패: HTTP " + response.getStatusCode());
            }
            
            long contentLength = response.getHeaders().getContentLength();
            if (contentLength <= 0) {
                // throw new IllegalStateException("Content-Length가 0 이하이거나 알 수 없습니다: " + contentLength);
                Thread.sleep(retryInterval);
                return RepeatStatus.CONTINUABLE;
            }
            
            return RepeatStatus.FINISHED;
        }
    }

    public static class S3UploadTasklet implements Tasklet {
        private final RestClient restClient;
        private final S3Client s3Client;
        private final String sourceUrl;
        private final String bucket;

        public S3UploadTasklet(RestClient restClient, S3Client s3Client, String sourceUrl, String bucket) {
            this.restClient = restClient;
            this.s3Client = s3Client;
            this.sourceUrl = sourceUrl;
            this.bucket = bucket;
        }

        @Override
        public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
            restClient.get().uri(sourceUrl).exchange((request, response) -> {
                String filename = "download.csv"; // 기본 파일명
                String contentDisposition = response.getHeaders().getFirst("Content-Disposition");
                
                // Header에서 파일명 추출
                if (contentDisposition != null && contentDisposition.contains("filename=")) {
                    filename = contentDisposition.split("filename=")[1].replace("\"", "").trim();
                }

                // 파일명과 확장자 분리 후 오늘 날짜 추가
                int dotIndex = filename.lastIndexOf(".");
                String name = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
                String ext = dotIndex > 0 ? filename.substring(dotIndex) : "";
                String date = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
                
                String s3Key = name + "_" + date + ext;

                // Zero-copy로 InputStream을 직접 S3에 업로드
                s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucket).key(s3Key).build(),
                    RequestBody.fromInputStream(response.getBody(), response.getHeaders().getContentLength())
                );

                // 다음 스텝(Postgres Copy)을 위해 S3 Key를 ExecutionContext에 저장
                chunkContext.getStepContext().getStepExecution().getJobExecution()
                    .getExecutionContext().put("uploadedS3Key", s3Key);

                return null;
            });
            return RepeatStatus.FINISHED;
        }
    }

    @RequiredArgsConstructor
    public static class PostgresCopyTasklet implements Tasklet {
        private final S3Client s3Client;
        private final String bucket;
        private final DataSource dataSource;
        private final String copySqlPath;
        private final String insertSqlPath;

        @Override
        public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {
            String s3Key = chunkContext.getStepContext().getStepExecution().getJobExecution()
                    .getExecutionContext().getString("uploadedS3Key");

            if (s3Key == null) {
                throw new IllegalStateException("이전 Step에서 업로드된 S3 Key를 찾을 수 없습니다.");
            }

            executeCopySql(s3Key);
            executeInsertSql();

            return RepeatStatus.FINISHED;
        }

        private void executeCopySql(String s3Key) throws Exception {
            try (ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(
                    GetObjectRequest.builder().bucket(bucket).key(s3Key).build())) {
                
                // DataSource 커넥션에서 PgConnection 추출
                try (Connection conn = dataSource.getConnection()) {
                    PGConnection pgConn = conn.unwrap(PGConnection.class);
                    CopyManager copyManager = pgConn.getCopyAPI();
                    
                    DefaultResourceLoader resourceLoader = new DefaultResourceLoader();
                    Resource copyRes = resourceLoader.getResource(copySqlPath);
                    String copySqlContent = FileCopyUtils.copyToString(new InputStreamReader(copyRes.getInputStream(), StandardCharsets.UTF_8));
                    
                    // S3 스트림을 STDIN으로 직접 카피
                    copyManager.copyIn(copySqlContent, s3Object);
                }
            }
        }

        private void executeInsertSql() throws Exception {
            if (insertSqlPath == null || insertSqlPath.isBlank()) {
                return;
            }

            DefaultResourceLoader resourceLoader = new DefaultResourceLoader();
            Resource insertRes = resourceLoader.getResource(insertSqlPath);
            String insertSqlContent = FileCopyUtils.copyToString(new InputStreamReader(insertRes.getInputStream(), StandardCharsets.UTF_8));
            
            NamedParameterJdbcTemplate jdbcTemplate = new NamedParameterJdbcTemplate(dataSource);
            MapSqlParameterSource params = new MapSqlParameterSource();
            params.addValue("snapshotDate", LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
            
            jdbcTemplate.update(insertSqlContent, params);
        }
    }
}
