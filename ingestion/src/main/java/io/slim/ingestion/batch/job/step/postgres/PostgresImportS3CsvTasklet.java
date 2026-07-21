package io.slim.ingestion.batch.job.step.postgres;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.step.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class PostgresImportS3CsvTasklet implements Tasklet {
    private final NamedParameterJdbcTemplate namedJdbcTemplate;
    private final ResourceLoader resourceLoader;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {
        // 1. JobParameters에서 Flatten된 값들을 개별적으로 꺼내기
        Map<String, Object> params = chunkContext.getStepContext().getJobParameters();
        String sqlResourcePath = (String) params.get("target.sqlResourcePath");
        String s3Bucket = (String) params.get("s3.bucket");
        String s3Key = (String) params.get("s3.key");
        String s3Region = (String) params.get("s3.region");
        String tableName = (String) params.get("target.tableName");
        String columns = (String) params.get("target.columns");
        String importOptions = (String) params.get("target.options");
        
        log.info("Starting S3 to Postgres import for table: {}", tableName);
        
        // 2. ResourceLoader로 SQL 파일 읽기
        Resource resource = resourceLoader.getResource(sqlResourcePath);
        if (!resource.exists()) {
            throw new IllegalArgumentException("SQL resource not found at path: " + sqlResourcePath);
        }
        String sql = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        
        // 3. MapSqlParameterSource 구성 및 파라미터 바인딩
        MapSqlParameterSource sqlParams = new MapSqlParameterSource()
                .addValue("tableName", tableName)
                .addValue("columns", columns != null ? columns : "")
                .addValue("importOptions", importOptions != null ? importOptions : "")
                .addValue("s3Bucket", s3Bucket)
                .addValue("s3Key", s3Key)
                .addValue("s3Region", s3Region);
        
        // 4. namedJdbcTemplate.queryForObject 실행
        log.debug("Executing SQL: \n{}", sql);
        String result = namedJdbcTemplate.queryForObject(sql, sqlParams, String.class);
        
        // 5. 결과를 로깅하고 ExecutionContext에 저장 후 RepeatStatus.FINISHED 반환
        log.info("Import completed successfully. Result: {}", result);
        chunkContext.getStepContext().getStepExecution().getExecutionContext().put("importResult", result);
        
        return RepeatStatus.FINISHED;
    }
}
