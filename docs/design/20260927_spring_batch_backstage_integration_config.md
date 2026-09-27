# Spring Batch × Backstage 통합 (설정 및 스케줄러) 설계 스펙

## 목표
Backstage를 배치 관리의 단일 진입점으로 만들되, Job 실행 로직(Spring Batch)과 도메인 설정 값을 완전히 분리해 화면·설정·Job이 서로 몰라도 되는 구조를 달성한다. 신규 배치 추가 시 코드 변경 없이 설정 스키마 등록만으로 실행 화면·설정 화면이 자동 생성되도록 한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: `Backstage PluginTaskScheduler`, `Airflow/Conductor` 3계층 분리 구조, `20260926_spring_batch_admin_backstage.md` (기존 Job Command Form 패턴)
- 신규로 가는 이유: 휴면계정 처리, 사용자 이력 수집 등 여러 배치가 각자 다른 화면과 방식으로 스케줄/파라터를 관리하고 있어 일관성이 없음. 이를 통합하기 위해 설정(Config), 스케줄러(db-scheduler), 실행(Spring Batch) 계층을 분리하여 의존성을 끊어냄.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 컴포넌트/모듈 위치 | 기존 `spring-batch-backstage` 백엔드 모듈에 통합 | 서비스 분리 비용(배포·인증·이벤트 전파) 대비 이점이 낮고, 트랜잭션/이벤트 동기화 처리가 용이함. |
| 스케줄러 계층 | `db-scheduler` (kagkarlsson) 사용 | Quartz 대비 스키마/설정이 단순하고, 영속적 클러스터 스케줄링을 경량으로 지원함. |
| 데이터 모델 | `settings`, `setting_history` (설정 저장/이력), `scheduled_tasks` (db-scheduler) | 민감 도메인의 변경 전후 이력 보존 요구사항 충족 및 감사 로그(`GET /history`) 지원. |
| 권한 제어 (RBAC) | `domain:dormant-account:config:write` 형태의 도메인 단위 스코프 적용 | `backstage-rbac`의 기존 도메인 단위 권한 모델과 일관성을 유지하여 RBAC 화면 불일치 방지. |
| 배달 보장 / 멱등성 | At-most-once (스케줄러). `JobParametersIncrementer`로 고유 파라미터 보장 | `db-scheduler`가 트리거 유일성을 보장하고, Spring Batch가 파라미터 조합으로 중복 실행을 거부함. 단, 비즈니스 로직(Job 내부)의 자체 멱등성 보장(예: 기처리 대상 Skip)이 전제되어야 함. |
| 동시성 제어 | Spring Batch `JobInstance` 제약 및 `JobExplorer` 상태 체크 적용 (YAGNI 타협) | 분산 락(Redis 등) 도입은 현 단계에서 오버엔지니어링(YAGNI)이므로 앱 레벨 제약으로 방어. 즉시실행과 주기실행이 정확히 겹치는 찰나의 극히 드문 race condition 리스크는 잔존함. |
| 실패/재시도 | 스케줄러 계층 재시도(Retry) 없음. 관리자가 수동 확인 후 즉시 실행 (Restart) | Spring Batch의 핵심 기능인 "실패 지점부터 이어하기"를 활용하기 위해 자동 재시도 대신 관리자 수동 처리. |
| 파라미터 시간 결합 | 상대값(예: "N일")을 그대로 Job 파라미터에 전달, Job 내부에서 `now()` 기준으로 실제 날짜 계산 | 절대 날짜로 미리 계산하면 스케줄 갱신 및 재처리/지연 실행 시 데이터 정합성이 깨질 위험이 큼. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트 (`XxxTest`):
  - `Config DTO`의 Bean Validation이 JSON Schema로 정상 변환되는지 검증
  - 설정 저장 성공 시 `SettingChangedEvent` 발행 로직 검증
  - 도메인 Job 내부의 시간 계산 로직(`now()` 주입 후 기준일 도출) 검증
- [ ] 통합테스트 (`XxxIT`):
  - 실제 DB(Testcontainers 권장) 환경에서 `PUT /api/config/settings/{key}` 호출 시 `setting_history` 적재 및 `db-scheduler` 트리거 갱신 확인 (트랜잭션/이벤트 연동)
  - 즉시 실행 API 호출 시 `JobLauncher` 직접 트리거 및 `JobExplorer` 기반 상태 반환 동작 검증 (Mock 대상: 외부 도메인 API)
- [ ] 커버리지 기준: 80% 이상

## 미결 사항
- 없음
