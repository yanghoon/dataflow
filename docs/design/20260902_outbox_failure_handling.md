# Outbox Failure & Backoff 설계 스펙

## 목표
아웃박스 이벤트 폴러(Outbox Poller)에서 영구 실패(Permanent Failure)와 일시적 실패(Retryable Failure)를 구분하여, 무의미한 재시도(Zombie Data)를 방지하고 일시적 오류에 대해 지수적 백오프(Exponential Backoff)를 적용한다. 카프카 없이 DB 인프라만으로 안정적인 큐 역할을 구현한다.

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**: 
  - `JdbcEventMessagePoller.java` (기존 동기/비동기 폴링 로직)
  - 스프링 부트 RabbitMQ/Kafka 재시도 설정 표준 (`spring.rabbitmq.listener.simple.retry.*`)
- **신규로 가는 이유**: 기존의 `void publishEvent` 구조는 예외 유무만 판단 가능하여 모든 실패를 동일하게 무한 재시도하는 치명적 한계(좀비 데이터 생성)가 존재했음.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| **책임 분리 (예외 처리)** | 핸들러는 비즈니스 예외(`PermanentFailureException`)만 던짐. 상태 갱신은 Poller가 전담. | 핸들러는 인프라(재시도 카운트 등)에 오염되지 않고 순수 로직만 유지. |
| **설계 구조 (YAML)** | `app.outbox.default.retry.max-attempts`, `initial-interval` 등 아웃박스 전용 섹션 구성 | HTTP 통신 레벨이 아닌 메시지 전송 계층의 정책이므로 별도 관리. 기존 스프링 표준 구조 차용. |
| **데이터 모델 (스키마)** | `ALTER TABLE` 없이 기존 `extensions` (JSONB) 컬럼 내에 `retry_count`, `next_retry_at` 주입 | 기존 클라우드 이벤트 스펙 호환 및 무중단 적용. |
| **동시성 제어** | 기존과 동일한 `FOR UPDATE SKIP LOCKED` | 다중 인스턴스 환경에서 경합 및 데드락 완벽 방지. |
| **조회 성능 최적화** | `CREATE INDEX idx_outbox_ready_retry ON outbox_event (((extensions->>'next_retry_at')::timestamp)) WHERE status = 'READY';` 부분 인덱스 도입 | 완료(`DONE`)된 수천만 건을 무시하고, `READY` 중 대기 시간이 지난 데이터만 Index-Only 스캔으로 초고속 조회. |
| **배달 보장 / 상태 전이** | 성공 시 `DONE`. `PermanentFailure` 또는 `max-attempts` 도달 시 `FAILED`. 대기 시 `retry_count++` 및 `next_retry_at` 갱신. | At-Least-Once 보장 및 무한루프(DLQ) 방어. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] DB 스크립트 작성: `idx_outbox_ready_retry` 부분 인덱스 생성 쿼리 추가.
- [ ] 유닛테스트: 
  - 핸들러가 `PermanentFailureException`을 던지면 즉시 `FAILED` 상태가 되는지 검증.
  - 핸들러가 `RestClientException`을 던지면 `extensions`에 백오프가 누적되는지 검증.
  - 최대 재시도 도달 시 `FAILED`로 변경되는지 검증.
- [ ] 커버리지 기준: 85% 이상

## 미결 사항 (추가 검토 사항)
- **데이터 보관주기 (Housekeeping / Retention)**: 
  - `DONE` 또는 `FAILED` 상태로 처리 완료된 아웃박스 이벤트는 무한정 쌓이지 않도록 **30일 보관(Retention)** 후 삭제하는 정책 적용이 필요함.
  - **구현 방향 (CloudNativePG 환경 플러그인/확장 기준)**:
    1. **pg_partman (대용량 권장)**: 생성일시 기준으로 테이블을 일(Daily) 단위 파티셔닝하고, 30일이 지난 파티션 테이블 자체를 `DROP`하는 방식. 대규모 `DELETE` 쿼리로 인한 DB 성능 저하와 데드튜플(Bloat) 발생을 원천 차단할 수 있어 아웃박스 패턴에 가장 적합함.
    2. **pg_cron (단순 구현)**: CloudNativePG에 내장 가능한 `pg_cron` 익스텐션을 사용하여 주기적으로 `DELETE FROM outbox_event WHERE status IN ('DONE', 'FAILED') AND created_at < NOW() - INTERVAL '30 days'` 쿼리를 실행. 단, 삭제량이 많을 경우 DB Lock을 막기 위해 chunk 단위로 끊어서 삭제하는 프로시저 작성이 필요함.
