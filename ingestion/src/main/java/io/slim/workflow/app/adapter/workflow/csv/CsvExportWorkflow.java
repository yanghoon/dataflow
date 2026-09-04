package io.slim.workflow.app.adapter.workflow.csv;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Properties;

import javax.sql.DataSource;

import org.postgresql.PGConnection;
import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.util.PropertyPlaceholderHelper;
import org.springframework.web.client.RestClient;

import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Slf4j
@RequiredArgsConstructor
public class CsvExportWorkflow implements Workflow {

    @Getter
    private final String type = "csv";

    private final Map<String, RestClient> restClients;
    private final Map<String, S3Client> s3Clients;
    private final DataSource dataSource;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ResourceLoader resourceLoader;

    private PropertyPlaceholderHelper keyParser = new PropertyPlaceholderHelper("{", "}");

    @Override
    public void execute(WorkflowJob job, WorkflowParams params) {
        try {
            var context = CsvExportContext.of(job, params);
            // 전체 절차 오케스트레이션만 담당, 세부는 private method(향후 Step)에 위임
            exportToCsv(context, params);
            uploadToS3(context);
            copyToPostgres(context);
            insertIntoSnapshotTable(context);

            log.info("CsvExportS3PgCopyWorkflow completed successfully. Inserted row count: {}", context.getCopyCount());
            // return new WorkflowExecutionResult(true, "Rows imported: " + rowCount);
        } catch (Exception e) {
            log.error("CsvExportS3PgCopyWorkflow execution failed", e);
            throw new RuntimeException(e);
            // return new WorkflowExecutionResult(false, e.getMessage());
        }
    }

    @Override
    public void validate(WorkflowJob job, WorkflowParams overrideParams) {
        CsvExportContext.of(job, overrideParams);
    }

    // ① 원본 조회 → 로컬 CSV 파일 생성
    // 책임: where.endpoint에서 데이터 조회, targetDate 등 WorkflowParams 반영
    private void exportToCsv(CsvExportContext ctx, WorkflowParams params) {
        var clientId = ctx.getRest().clientId();
        var path = ctx.getRest().path();

        if (path == null || path.isBlank()) {
            throw new IllegalArgumentException("props.path is not defined");
        }

        // WorkflowParams를 통한 targetDate 치환 (파라미터가 없으면 오늘 날짜 사용)
        // String targetDate = params.get("targetDate");
        // if (targetDate == null) {
        //     targetDate = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        // }

        // String url = path;
        // if (url.contains("{targetDate}")) {
        //     url = url.replace("{targetDate}", targetDate);
        // } else {
        //     url += (url.contains("?") ? "&" : "?") + "targetDate=" + targetDate;
        // }

        log.info("Fetching CSV from path: {}", path);
        restClients.get(clientId).get().uri(path).exchange((request, response) -> {
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Failed to fetch CSV: HTTP " + response.getStatusCode());
            }

            var tempFile = Files.createTempFile("export-", ".csv");
            var size = Files.copy(response.getBody(), tempFile, StandardCopyOption.REPLACE_EXISTING);

            if (size == 0) {
                throw new RuntimeException("Csv file size is zero");
            }
            
            ctx.setTempFile(tempFile);
            return tempFile;
        });
    }

    // ② 생성된 CSV를 S3에 업로드
    // 책임: where의 버킷/경로 정보로 업로드, 업로드 후 원본 임시파일 정리
    private String uploadToS3(CsvExportContext ctx) {
        var clientId = ctx.getS3().clientId();
        var bucket = ctx.getS3().bucket();
        var keyPattern = ctx.getS3().keyPattern();

        if (bucket == null || bucket.isBlank()) {
            throw new IllegalArgumentException("bucket is not defined");
        }

        var keyParams = new Properties();
        keyParams.putAll(Map.of(
            // "filename", res
            "date", LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))
        )); 
        var s3Key = keyParser.replacePlaceholders(keyPattern, keyParams);

        log.info("Uploading CSV to S3: s3://{}/{}", bucket, s3Key);
        try {
            s3Clients
                .get(clientId)
                .putObject(
                    PutObjectRequest.builder().bucket(bucket).key(s3Key).build(),
                    ctx.getTempFile()
                );
            ctx.setS3Key(s3Key);
            return s3Key;
        } finally {
            try {
                Files.deleteIfExists(ctx.getTempFile());
            } catch (IOException e) {
                log.warn("Failed to delete temporary CSV file: {}", ctx.getTempFile(), e);
            }
        }
    }

    // ③ S3의 CSV를 PostgreSQL CopyManager로 적재
    // 책임: where.targetTable 대상, CopyManager 스트리밍 적재, 처리 건수 반환
    private void copyToPostgres(CsvExportContext ctx) {
        var clientId = ctx.getS3().clientId();
        var bucket = ctx.getS3().bucket();
        var s3Key = ctx.getS3Key();
        var targetTable = ctx.getPostgres().tableName();

        if (targetTable == null || targetTable.isBlank()) {
            throw new IllegalArgumentException("where.targetTable is not defined");
        }

        log.info("Copying CSV from S3 to PostgreSQL table: {}", targetTable);
        var s3Req = GetObjectRequest.builder().bucket(bucket).key(s3Key).build();

        try (var s3Object = s3Clients.get(clientId).getObject(s3Req);
             var conn = dataSource.getConnection()) {

            // truncate 여부 확인 (where 맵에서 옵션 가져오기)
            // boolean appendMode = Boolean.parseBoolean(where.getOrDefault("append", "false"));
            try (var stmt = conn.createStatement()) {
                stmt.execute("DELETE FROM " + targetTable);
            }

            // CopyManager 초기화 및 스트리밍 적재 시작
            var copySql = String.format("COPY %s FROM STDIN WITH (FORMAT csv, HEADER true)", targetTable);
            var copyManager = conn.unwrap(PGConnection.class).getCopyAPI();
            var counts = copyManager.copyIn(copySql, s3Object);

            ctx.setCopyCount(counts);
        } catch (Exception e) {
            throw new RuntimeException("Failed to copy data from S3 to Postgres", e);
        }
    }

    private void insertIntoSnapshotTable(CsvExportContext ctx) throws Exception {
        var sql = resourceLoader.getResource(ctx.getPostgres().insertSql()).getContentAsString(Charset.defaultCharset());
        var params = new MapSqlParameterSource(Map.of(
            "snapshotDate", LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
            "systemId", ctx.getPostgres().systemId()
        ));

        sql = sql.replace(":tableName", ctx.getPostgres().tableName());
        jdbcTemplate.update(sql, params);
    }

}
