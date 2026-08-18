package io.slim.workflow.app.adapter.workflow.csv;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

import javax.sql.DataSource;

import org.postgresql.PGConnection;
import org.postgresql.copy.CopyManager;
import org.springframework.web.client.RestClient;

import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Slf4j
@RequiredArgsConstructor
public class CsvExportS3PgCopyWorkflow implements Workflow {

    private final RestClient restClient;
    private final S3Client s3Client;
    private final DataSource dataSource;

    @Override
    public void execute(WorkflowJob snapshot, WorkflowParams params) {
        try {
            // 전체 절차 오케스트레이션만 담당, 세부는 private method(향후 Step)에 위임
            Path csvFile = exportToCsv(snapshot, params);
            String s3Key = uploadToS3(csvFile, snapshot);
            long rowCount = copyToPostgres(s3Key, snapshot);

            log.info("CsvExportS3PgCopyWorkflow completed successfully. Inserted row count: {}", rowCount);
            // return new WorkflowExecutionResult(true, "Rows imported: " + rowCount);
        } catch (Exception e) {
            log.error("CsvExportS3PgCopyWorkflow execution failed", e);
            // return new WorkflowExecutionResult(false, e.getMessage());
        }
    }

    // ① 원본 조회 → 로컬 CSV 파일 생성
    // 책임: where.endpoint에서 데이터 조회, targetDate 등 WorkflowParams 반영
    private Path exportToCsv(WorkflowJob snapshot, WorkflowParams params) {
        Map<String, String> where = snapshot.props();
        String endpoint = where.get("endpoint");

        if (endpoint == null || endpoint.isBlank()) {
            throw new IllegalArgumentException("where.endpoint is not defined");
        }

        // WorkflowParams를 통한 targetDate 치환 (파라미터가 없으면 오늘 날짜 사용)
        String targetDate = params.get("targetDate");
        if (targetDate == null) {
            targetDate = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        }

        String url = endpoint;
        if (url.contains("{targetDate}")) {
            url = url.replace("{targetDate}", targetDate);
        } else {
            url += (url.contains("?") ? "&" : "?") + "targetDate=" + targetDate;
        }

        log.info("Fetching CSV from endpoint: {}", url);
        return restClient.get().uri(url).exchange((request, response) -> {
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Failed to fetch CSV: HTTP " + response.getStatusCode());
            }
            Path tempFile = Files.createTempFile("export-", ".csv");
            Files.copy(response.getBody(), tempFile, StandardCopyOption.REPLACE_EXISTING);
            return tempFile;
        });
    }

    // ② 생성된 CSV를 S3에 업로드
    // 책임: where의 버킷/경로 정보로 업로드, 업로드 후 원본 임시파일 정리
    private String uploadToS3(Path csvFile, WorkflowJob snapshot) {
        Map<String, String> where = snapshot.props();
        String bucket = where.get("bucket");
        String prefix = where.getOrDefault("s3Prefix", "exports");

        if (bucket == null || bucket.isBlank()) {
            throw new IllegalArgumentException("where.bucket is not defined");
        }

        String s3Key = prefix + "/" + csvFile.getFileName().toString();

        log.info("Uploading CSV to S3: s3://{}/{}", bucket, s3Key);
        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucket).key(s3Key).build(),
                    csvFile
            );
            return s3Key;
        } finally {
            try {
                Files.deleteIfExists(csvFile);
            } catch (IOException e) {
                log.warn("Failed to delete temporary CSV file: {}", csvFile, e);
            }
        }
    }

    // ③ S3의 CSV를 PostgreSQL CopyManager로 적재
    // 책임: where.targetTable 대상, CopyManager 스트리밍 적재, 처리 건수 반환
    private long copyToPostgres(String s3Key, WorkflowJob snapshot) {
        Map<String, String> where = snapshot.props();
        String bucket = where.get("bucket");
        String targetTable = where.get("targetTable");

        if (targetTable == null || targetTable.isBlank()) {
            throw new IllegalArgumentException("where.targetTable is not defined");
        }

        log.info("Copying CSV from S3 to PostgreSQL table: {}", targetTable);
        var s3Req = GetObjectRequest.builder().bucket(bucket).key(s3Key).build();

        try (var s3Object = s3Client.getObject(s3Req);
             var conn = dataSource.getConnection()) {

            // truncate 여부 확인 (where 맵에서 옵션 가져오기)
            boolean appendMode = Boolean.parseBoolean(where.getOrDefault("append", "false"));
            if (!appendMode) {
                try (var stmt = conn.createStatement()) {
                    stmt.execute("DELETE FROM " + targetTable);
                }
            }

            // CopyManager 초기화 및 스트리밍 적재 시작
            String copySql = String.format("COPY %s FROM STDIN WITH (FORMAT csv, HEADER true)", targetTable);
            CopyManager copyManager = conn.unwrap(PGConnection.class).getCopyAPI();
            return copyManager.copyIn(copySql, s3Object);
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to copy data from S3 to Postgres", e);
        }
    }
}
