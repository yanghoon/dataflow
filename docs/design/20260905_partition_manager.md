# Java 기반 PostgreSQL 파티션 매니저 설계 스펙

## 목표
pg_partman 확장 플러그인이 사용 불가능한 air-gapped 환경에서, 자바 애플리케이션 레벨로 파티션 생성/유지보수/보존정책 삭제를 자동화하는 기능을 구현한다.

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**: pg_partman의 `create_parent()` / `run_maintenance()` 메커니즘 — `part_config` 메타데이터 테이블 + 주기 실행 함수로 파티션을 관리하는 구조. PGMQ의 큐/아카이브 테이블 파티션 컬럼 분리 정책(발생시각 vs 이동시각)도 참조.
- **신규로 가는 이유**: pg_partman은 PostgreSQL 확장(extension)이라 설치 시 서버 재시작 및 `shared_preload_libraries` 설정이 필요 — air-gapped 환경 정책상 확장 설치 불가. Java 전용 대체 라이브러리는 조사 결과 존재하지 않음(pg_partman 자체가 PL/pgSQL 기반이라 생태계 공백 지대) — 직접 구현이 표준적 선택.

## 설계 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | 해당 없음 (메시징이 아닌 스키마 유지보수 작업) | 파티션 생성/삭제는 멱등 연산으로 설계 — 재실행 안전성이 핵심 |
| 동시성 제어 | db-scheduler의 `scheduled_tasks` 테이블 단일 실행 보장에 전적으로 위임 (advisory lock 불필요) | db-scheduler가 유일한 트리거인 상황에서 이미 신뢰하는 인프라를 이중 보호하는 것은 YAGNI 원칙 위배 및 불필요한 복잡도 유발 |
| 실패/재시도 | DDL 생성 실패 시 즉시 알림 + 다음 주기 재시도(멱등 생성이라 안전), 삭제 실패는 수동 개입 필요 시 알림만 | 스키마 변경은 데이터 유실 위험이 있어 자동 재시도보다 가시성 우선 |
| 데이터 모델 | `partition_manager_config` 테이블 신설 — parent_table, control_column, interval, premake, retention, retention_action, cron_override 컬럼 (`cron_override`는 nullable로 추가만 해둠) | pg_partman 스키마 구조 이식. `cron_override`는 테이블별 스케줄링이 필요해질 미래를 대비해 스키마 변경 비용 없이 데이터만 추가할 수 있도록 저렴하게 확보 |
| 파라미터 시간 결합 (기준 시간) | 파티션 네이밍: `{table}_p{yyyyMMdd}` / `{table}_p{yyyyMM}` 포맷 사용. 기준 시간: DB 시계(`CURRENT_TIMESTAMP` 또는 `now()`)를 파티션 계산 로직 진입 시마다 새로 조회. | 네이밍은 pg_partman 관례를 따라 마이그레이션 혼란 방지. 기준 시간은 다중 인스턴스 간 NTP drift로 인한 판단 오차를 막기 위해 단일 진실 소스인 DB에 위임. "natural key는 원본값" 원칙 유지. |
| 파티션 보존 정책(retention_action) 기본값 | `DETACH` 기본값 채택. (DROP은 검증 완료 후 config override로 전환 가능하게 opt-in) | 초기 도입 시 버그로 인한 데이터 유실 방지. 2단계 삭제 전략(DETACH 후 별도 배치 삭제)을 통해 안전성 확보. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트:
  - 파티션 이름 생성 규칙(`{table}_p{yyyyMMdd}` 등) 검증
  - premake 부족분 계산 로직(기존 파티션 diff) 검증
  - retention 초과 파티션 판별 로직 검증 (단, 기준 시간은 파라미터로 주입하여 고정 날짜로 검증)
- [ ] 통합테스트 (DB 연동 검증 위주, 애플리케이션 시계나 db-scheduler 로직 모킹 지양):
  - 실제 PostgreSQL(Testcontainers)에 대해 `CREATE TABLE ... PARTITION OF` 실행 후 `pg_inherits` 반영 확인
  - 기준 시간(`SELECT now()`) 조회 연동 및 쿼리 동작 확인
  - retention 정책에 따른 DETACH 실행 후 카탈로그 반영 및 데이터 잔존 확인
- [ ] 커버리지 기준: 85% 이상

## 미결 사항
- 없음
