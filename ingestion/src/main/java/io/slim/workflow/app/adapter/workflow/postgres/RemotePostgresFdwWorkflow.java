package io.slim.workflow.app.adapter.workflow.postgres;

import java.nio.charset.Charset;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
public class RemotePostgresFdwWorkflow implements Workflow {

    @Getter
    private final String type = "postgres-fdw";

    private final ResourceLoader resourceLoader;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Override
    public void execute(WorkflowJob job, WorkflowParams params) {
        try {
            // 전체 절차 오케스트레이션, 세부는 private method(향후 Step)에 위임
            var context = PostgresFdwContext.of(job, params);
            verifyForeignTable(context);
            insertIntoSnapshotTable(context);
            // String stagingTable = copyViaFdw(context, params);
            // swapToLocalTable(stagingTable, job);
            
            log.info("completed successfully");
            // return new WorkflowExecutionResult(true, "Data swapped successfully via FDW");
        } catch (Exception e) {
            log.error("execution failed", e);
            // return new WorkflowExecutionResult(false, e.getMessage());
        }
    }

    // ① 원격 테이블 매핑/접근 권한 사전 검증
    // 책임: where.foreignTable이 postgres_fdw로 정상 연결되는지,
    //       스키마 drift(컬럼 변경) 여부 확인 — 실패 시 이후 단계 진입 차단
    private void verifyForeignTable(PostgresFdwContext context) {
        var tableName = context.getPostgres().tableName();

        if (tableName == null || tableName.isBlank()) {
            throw new IllegalArgumentException("where.foreignTable is not defined");
        }

        log.info("Verifying foreign table: {}", tableName);
        // 단순히 LIMIT 1 쿼리로 연결성 검증
        try {
            var verifySql = "SELECT 1 FROM " + tableName + " LIMIT 1";
            jdbcTemplate.getJdbcTemplate().execute(verifySql);
            log.info("Foreign table {} is accessible.", tableName);
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify foreign table access for " + tableName, e);
        }
    }

    private void insertIntoSnapshotTable(PostgresFdwContext ctx) throws Exception {
        var sql = resourceLoader.getResource(ctx.getPostgres().insertSql()).getContentAsString(Charset.defaultCharset());
        var params = new MapSqlParameterSource(Map.of(
            "snapshotDate", LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
            "systemId", ctx.getPostgres().systemId()
        ));

        sql = sql.replace(":tableName", ctx.getPostgres().tableName());
        jdbcTemplate.update(sql, params);
    }

    // // ② FDW 경유로 원격 데이터를 로컬 스테이징 테이블에 복사
    // // 책임: SELECT ... FROM foreign_table (params.targetDate 등으로 범위 제한)
    // //       → INSERT INTO staging_table, 대용량 시 배치 커밋 단위 분할
    // private String copyViaFdw(WorkflowJob snapshot, WorkflowParams params) {
    //     Map<String, String> where = snapshot.props();
    //     String foreignTable = where.get("foreignTable");
    //     String targetTable = where.get("targetTable");
        
    //     if (targetTable == null || targetTable.isBlank()) {
    //         throw new IllegalArgumentException("where.targetTable is not defined");
    //     }

    //     // 유니크한 스테이징 테이블 생성
    //     String stagingTable = targetTable + "_staging_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    //     log.info("Creating staging table {} from foreign table {}", stagingTable, foreignTable);

    //     // 파라미터 기반의 필터링 조건이 필요할 수 있음
    //     String targetDate = params.get("targetDate");
    //     if (targetDate == null) {
    //         targetDate = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    //     }
        
    //     // 예제 구현: CREATE TABLE ... AS SELECT ...
    //     // 만약 전체 데이터 스왑 방식이라면 모든 데이터를 가져옵니다. 
    //     // 증분일 경우 INSERT INTO 방식과 조건절 분리가 필요합니다.
    //     String createStagingSql = String.format("CREATE TABLE %s (LIKE %s INCLUDING ALL)", stagingTable, targetTable);
    //     namedJdbcTemplate.getJdbcTemplate().execute(createStagingSql);

    //     String insertSql = String.format("INSERT INTO %s SELECT * FROM %s", stagingTable, foreignTable);
    //     log.info("Executing FDW copy to staging: {}", insertSql);
    //     namedJdbcTemplate.getJdbcTemplate().execute(insertSql);
        
    //     return stagingTable;
    // }

    // // ③ 스테이징 테이블을 실제 서비스 테이블로 무중단 교체
    // // 책임: where.targetTable과 staging_table을 원자적 스왑(ALTER TABLE RENAME 등)
    // //       하여 조회 중단 없이 최신 데이터로 전환, 이전 테이블은 정리
    // private void swapToLocalTable(String stagingTable, WorkflowJob snapshot) {
    //     Map<String, String> where = snapshot.props();
    //     String targetTable = where.get("targetTable");
    //     String backupTable = targetTable + "_backup_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

    //     log.info("Swapping target table {} with staging table {}", targetTable, stagingTable);

    //     // 원자적(Atomic) 스왑을 위해 트랜잭션 내에서 실행
    //     String swapScript = String.format("""
    //             BEGIN;
    //             DROP TABLE IF EXISTS %s;
    //             ALTER TABLE IF EXISTS %s RENAME TO %s;
    //             ALTER TABLE %s RENAME TO %s;
    //             COMMIT;
    //             """,
    //             backupTable, // 혹시 모를 기존 백업 테이블 드랍(안전장치)
    //             targetTable, backupTable, // 기존 서비스 테이블을 백업으로
    //             stagingTable, targetTable // 스테이징 테이블을 서비스 테이블로
    //     );

    //     try {
    //         // 주의: 여러 SQL Statement를 실행할 땐 NamedParameterJdbcTemplate.getJdbcTemplate().execute 등 사용
    //         namedJdbcTemplate.getJdbcTemplate().execute(swapScript);
            
    //         // 필요 시 이전 백업 테이블 삭제 로직 추가
    //         // namedJdbcTemplate.getJdbcTemplate().execute("DROP TABLE " + backupTable);
    //         log.info("Swap successfully completed. Old data backed up to: {}", backupTable);
    //     } catch (Exception e) {
    //         log.error("Failed to swap tables. Rolling back.", e);
    //         throw new RuntimeException("Table swap failed", e);
    //     }
    // }
}
