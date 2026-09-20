# 이벤트 큐 처리 파이프라인 설계 스펙

## 목표
db-scheduler로 트리거되는 배치 잡이 원본 데이터에서 대상을 추출해 이벤트 큐 테이블에 CloudEvent 형식으로 적재하고, 동일 잡이 주기적으로 큐를 폴링하여 외부 API 호출(webhook 발송, 계정 정지, 메일 발송 등)을 수행한다. 다중 인스턴스/분산 환경에서 중복 실행, 유실, 좀비 상태 없이 안전하게 동작해야 한다.

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**: CloudEvents v1.0 스펙(공식 SDK, `CloudEventBuilder`), db-scheduler(RecurringTask, SKIP LOCKED 기반 분산 실행), Spring `NamedParameterJdbcTemplate` batchUpdate 패턴.
- **신규로 가는 이유**: Kafka 도입은 검토했으나 워크로드(느린 외부 API, 낮은 처리율, rate limit 제약)와 근본적으로 안 맞아 기각(파티션 확장이 무의미, poll interval 초과로 인한 rebalance 위험, 재시도 토픽 이관 시 순서 보장 상실). RabbitMQ는 유망하나 최종 결정 전 단계로 보류. Spring Integration JDBC는 기본 동작이 이미 이 스펙의 "롱 트랜잭션" 방식과 동일해 도입 실익 낮음 — 직접 구현 채택.

## 설계 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | At-least-once. 멱등성은 GET 가능한 API는 GET-then-PUT으로 방어, 불가능한 행위형 API는 중복 실행 의도적 감수 | 외부 API 전수 확인 결과 멱등성 미지원. 완벽한 방어가 불가능한 조합임을 인정하고 확률을 낮추는 선에서 타협 |
| 동시성 제어 | `SELECT ... FOR UPDATE SKIP LOCKED`로 배타적 claim. claim부터 결과 반영까지 단일 트랜잭션 처리 | 여러 워커/인스턴스가 같은 row를 중복 처리하지 않도록 DB 락으로 배타성 확보. 크래시 시 롤백되어 안전하게 PENDING 복귀 보장 |
| 실패/재시도 (Backoff) | 핸들러 예외 시 상태를 `PENDING`으로 복귀시키되, `retry_count` 증가 및 `next_retry_at`을 백오프 로직에 따라 갱신(애플리케이션 시계 사용). `maxRetries`(yaml 설정값) 도달 시 `FAILED` 종결 | 외부 시스템 장애 시 즉시 재시도로 인한 큐 고갈 및 과부하 방지. 별도 대기 상태 신설 없이 조회 조건식(`next_retry_at <= now()`)만으로 우아하게 해결 |
| 데이터 모델 | `event_queue` 테이블. CloudEvents 필드(id, source, type, subject, time, data) + 상태 4종(`PENDING, CONFIRMED, FAILED, CANCELLED`), `retry_count`, `next_retry_at` | 롱 트랜잭션 락이 소유권을 대체하므로 PROCESSING 상태 제거로 단순화. 최초 적재 시 `next_retry_at`을 `CURRENT_TIMESTAMP`로 세팅하여 `IS NULL` 복잡도 제거 |
| 파라미터 시간 결합 | `time`(발생시각)과 `next_retry_at`(재시도예정시각)은 애플리케이션 시계(`Instant.now()`) 기준 절대값으로 계산하여 DB에 삽입 | DB 의존성을 낮추고 테스트 시 `Clock` 빈 주입을 통한 시간 조작(Time Travel) 검증을 용이하게 함 |

### 타임아웃 계층 (필수 — 누락 시 hang으로 인한 락 무한 점유 위험)
반드시 다음 순서(짧은 것 → 긴 것)로 설정해야 한다 (yaml 등 설정파일 기반):
1. RestClient 응답/커넥션 타임아웃 (예: 5초)
2. `CompletableFuture.orTimeout()` — 2차 방어선 (예: 10초)
3. JDBC 클라이언트 타임아웃
4. DB statement_timeout (전체 처리량 기반 계산: claim건수 × 단건최대시간 ÷ 동시성 + 여유분)
5. db-scheduler 폴링 주기

- **필수 이유**: HTTP 레벨에서 연결을 끊어야 스레드 누수 방지. db-scheduler 주기가 최상위여야 처리 지연 누적 방지.

### 예외 처리 표준 패턴 (핸들러)
```java
private MessageHandlingResult tryDispatch(CloudEvent event) {
    handler.handle(event); // 예외를 캐치하지 않고 그대로 던짐
    return new MessageHandlingResult(event.getId(), CONFIRMED, event.retryCount(), null);
}

CompletableFuture<MessageHandlingResult> future = CompletableFuture
    .supplyAsync(() -> tryDispatch(event), executor)
    .orTimeout(10, TimeUnit.SECONDS) // 설정값 바인딩 필요
    .handle((result, ex) -> {
        if (ex != null) {
            int nextRetry = event.retryCount() + 1;
            EventStatus next = nextRetry < maxRetries ? PENDING : FAILED;
            // 지연 시간 계산 (예: retry * 5분)
            Instant nextRetryAt = nextRetry < maxRetries ? calculateBackoff(nextRetry) : null;
            return new MessageHandlingResult(event.getId(), next, nextRetry, nextRetryAt);
        }
        return result;
    });
```
- **필수 이유**: `CompletableFuture.allOf().join()` 시 exceptionally 상태로 중단되는 것을 막고, 배치 처리된 전체 건들의 성공/실패 여부를 DB에 안전하게 일괄 기록(`batchUpdate`)하기 위함.

## 완료 조건 (자가검증)
- [ ] **컴파일/빌드 통과**
- [ ] **유닛테스트 (단위/로직 검증)**:
  - `MessageHandlingResult` 매핑: 반환 순서가 뒤섞이더라도 올바른 `id`에 상태가 반영되는지
  - 예외/타임아웃 시 `.handle()`에서 `PENDING` 전환 및 `next_retry_at`의 지연 시간 계산이 정확한지 (`Clock` 목킹)
  - `retry_count` 소진 시 `FAILED` 전이 및 `next_retry_at = null` 처리 여부
  - GET-then-PUT 정책: 외부 API 조회 후 이미 반영된 건이면 PUT을 skip 하는지
- [ ] **통합테스트 (DB 연동, Testcontainers 필수)**:
  - `FOR UPDATE SKIP LOCKED` 동시성: 두 세션(스레드)이 동시에 같은 row를 claim하지 못함을 실제 재현
  - `next_retry_at` 필터링: 아직 재시도 시간이 도래하지 않은 `PENDING` row는 claim되지 않고 스킵되는지 확인
  - statement_timeout 초과 시 트랜잭션 롤백 및 기존 데이터(`PENDING`) 보존 확인
  - 락 반환 시뮬레이션: 워커 처리 중 강제 kill 후 재기동 시 별도의 조치 없이 자연스럽게 재처리되는지 (좀비 락 없음)
  - **HikariCP 커넥션 고갈 한계 테스트**: 외부 API 지연(예: 5초) 발생 시 커넥션 점유에 따른 애플리케이션 장애 임계치 확인. (임계치 초과 시 짧은 트랜잭션 및 Reaper 모델로 재검토 트리거)
- [ ] **커버리지 기준**: 핵심 파이프라인 로직 라인 커버리지 85% 이상

## 미결 사항
- RestClient/JDBC/statement_timeout/폴링 주기 및 백오프 증가량의 구체적 수치값 — 실제 외부 API 응답시간 분포 측정 후 확정 (application.yml 정의)
- claim LIMIT(1회 폴링당 처리 건수)의 구체적 값 — 외부 API별 실제 처리율 측정 후 확정
- **상태 모델 불일치 및 통합 여부**: 기존 플랫폼(`task_queue`)의 짧은 트랜잭션 상태 모델(PENDING → PROCESSING → DONE)과 현재 파이프라인의 상태 모델이 다르므로 운영 시 혼란이 발생할 수 있음. 두 파이프라인 간 상태 모델 불일치 이슈 및 통합 여부는 별도 검토 필요
