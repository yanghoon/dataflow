# Batch Console Schedule API & Page 설계 스펙

## 목표
- `db-scheduler` 기반으로 스케줄 관련 API를 백엔드에 제공하고, Spring Batch Console Backstage 플러그인에 `SchedulePage`를 추가한다.
- `ScheduleController`는 특정 스케줄러 구현체(db-scheduler 등)에 강결합되지 않도록 인터페이스(`JobSchedulerService`, `JobSchedulerRepository`)를 기반으로 설계한다.
- 프론트엔드에서는 신규 스케줄 등록 폼(cron 주기 설정 등)에서 기존 `JobRunForm`의 params 렌더링 로직을 재사용하며, 스케줄의 수정/삭제(취소)도 지원한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: 
  - 백엔드: `/api/jobs` 엔드포인트를 제공하는 기존 Batch Console Controller
  - 프론트엔드: `backstage/plugins/batch-console` 내 `JobRunForm`, `JobRunPage` 패턴 및 JSON Schema Validator 기반 렌더링 로직
- 신규로 가는 이유: 기존 `WorkflowJobViewController` 등은 백엔드 내부 어드민용이거나 특정 구현체 클라이언트(`SchedulerClient`)에 직접 의존. 본 작업은 Backstage 범용 API(`/api/batch/schedules`, `io.slim.batch.console` 하위)로 인터페이스를 분리하여 제공하기 위함.

## 구현 대상 명세
| 대상 유형 | 파일/패키지 경로 | 클래스/컴포넌트명 | 주요 역할 및 설명 |
|---|---|---|---|
| 신규(Backend) | `ingestion/src/main/java/io/slim/batch/console/web/ScheduleController.java` | `ScheduleController` | `/api/batch/schedules` 엔드포인트 제공 (생성, 조회, 수정, 취소) |
| 신규(Backend) | `ingestion/src/main/java/io/slim/batch/console/scheduler/JobSchedulerService.java` | `JobSchedulerService` | 스케줄 등록/관리 인터페이스 |
| 신규(Backend) | `ingestion/src/main/java/io/slim/batch/console/scheduler/JobSchedulerRepository.java` | `JobSchedulerRepository` | 영속성 처리 인터페이스 |
| 신규(Backend) | `ingestion/src/main/java/io/slim/batch/console/scheduler/DbJobSchedulerRepository.java` | `DbJobSchedulerRepository` | `db-scheduler`의 `SchedulerClient`를 감싼 구현체 |
| 신규(Backend) | `ingestion/src/main/java/io/slim/batch/console/scheduler/DbJobSchedulerService.java` | `DbJobSchedulerService` | `JobSchedulerService`의 구현체 |
| 신규(Frontend)| `backstage/plugins/batch-console/src/components/SchedulePage.tsx` | `SchedulePage` | 스케줄 목록 조회 및 등록/수정/삭제 제공 |
| 수정(Frontend)| `backstage/plugins/batch-console/src/plugin.ts` 등 라우팅 파일 | 플러그인 라우트 | `SchedulePage` 컴포넌트 라우팅 추가 |

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | db-scheduler 기본 동작 | At-most-once(Locking 기반) 또는 db-scheduler 설정에 따름 |
| 동시성 제어 | db-scheduler의 DB Lock 활용 | 별도 Application 레벨 Lock 미구현 (기반 기술 의존) |
| 실패/재시도 | db-scheduler 기본 위임 | 이번 스코프에서 커스텀 재시도 로직 제외 |
| 서브모듈/소비자 영향도 | Backstage 플러그인 연동 | 백엔드 API 신설 후 프론트 플러그인(Consumer)에서 즉시 연동 및 폼 UI 사용 |
| 데이터 모델 | `scheduled_tasks` 단일 테이블 | 자체 관리 테이블 없이, db-scheduler 기본 테이블의 `task_data` 컬럼에 파라미터 및 Cron 식 등을 직렬화해 저장. 스케줄 비활성화/삭제는 Task Cancel로 처리 |
| 파라미터 시간 결합 (절대/상대, 계산 위치) | Job 내부 동적 치환 | 스케줄러 자체에서는 날짜 치환 로직 배제. Schema description 기반 안내 후 실제 Job 실행 시 현재 시간 동적 매핑 |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트: 
  - `JobSchedulerService` 비즈니스 로직 단위 테스트 (스케줄 등록/수정/삭제)
- [ ] 통합테스트:
  - `DbJobSchedulerRepositoryIT`: `SchedulerClient` 등 의존성을 통해 Schedule 데이터 영속화(task_data 저장) 경계 검증 (Mock 또는 인메모리 DB)
- [ ] 커버리지 기준: 80% 이상

## 미결 사항
- 없음
