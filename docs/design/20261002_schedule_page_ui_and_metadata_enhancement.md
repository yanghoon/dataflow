# Spring Batch Console UI 개편 및 메타데이터 확장 (SchedulePage & BatchJobsPage)

## 목표
- **SchedulePage UI 개편 & 메타데이터 확장**:
  - `backstage/plugins/batch-console/src/components/SchedulePage.tsx` 상단의 컬러풀한 schedules 헤더 영역을 주석 처리한다.
  - `Register Schedule` 버튼의 레이블을 `Create`로 변경하고 테이블 우측 상단으로 이동한다.
  - `Scheduled Jobs` 표에서 행(Row) 클릭 시 parameters를 YAML 형태로 행 하단(Detail Panel / Collapse)에 확장 출력한다.
  - 표 컬럼에 등록일(`Created At`), 마지막 실행 시간(`Last Run`), 마지막 실행 상태(`Last Status`)를 추가한다.
    - 시간 표시는 15일 이내인 경우 `xxx ago` 상대 시간으로 표시하고, 15일 초과 시 고정 날짜(`YYYY-MM-DD HH:mm`)로 표시한다.
    - 마지막 실행 시간/상태 기준은 `db-scheduler`의 스케줄 실행 기록(`lastSuccess`, `lastFailure`, `isPicked`)을 기준으로 산출한다.
  - 표 Actions 컬럼에 Run(즉시 실행) 버튼 및 실행이력 바로보기(`/spring-batch`) 링크 아이콘을 추가한다.
    - Run 버튼 클릭 시 파라미터 입력 다이얼로그(`maxWidth="md"`)를 띄우고 현재 설정된 파라미터를 기본값으로 채운다.
    - 다이얼로그 내 파라미터 Key-Value 입력 UI는 `ExecuteJobPage.tsx`의 직관적인 디자인(Grid, Add/Delete IconButton)을 차용한다.
    - Run 실행 시 `api.runJob`을 호출하여 즉시 실행하며, 기존 스케줄 설정에는 영향을 주지 않는다.
- **BatchJobsPage 개편 (기존 BatchConsolePage)**:
  - `BatchConsolePage.tsx`를 `BatchJobsPage.tsx` (컴포넌트명 `BatchJobsPage`)로 리네이밍한다.
  - 상단 헤더 영역을 주석 처리한다.
  - `SpringBatchPage.tsx` 스타일(`InfoCard` 래핑, 헤더 대문자 볼드 스타일, 행 hover 및 줄무늬 스타일)을 적용한다.
  - `JobExplorer` 메타데이터 기반으로 풍부한 컬럼(`Job Name`, `Restartable`, `Total Runs`, `Last Status`, `Last Run`, `Actions(Run/History)`)을 추가한다.

- **사이드바 메뉴 링크 변경**:
  - 사이드바의 `Spring Batch` 메뉴 아이템 클릭 시 기존 대시보드(`/spring-batch`) 대신 우리가 개발한 Schedule Job 화면(`/platform/batch/schedules`)으로 이동하도록 링크를 교체한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴:
  - 프론트엔드 네비게이션: `backstage/packages/app/src/modules/nav/Sidebar.tsx`의 `SidebarItem` 및 `nav.take()` 패턴
  - 프론트엔드 표 스타일 및 상태 칩: `backstage/plugins/spring-batch-dashboard/src/components/SpringBatchPage/SpringBatchPage.tsx` 및 `StatusChip.tsx`
    - `InfoCard` 래핑, 대문자/세리프 헤더 셀(`fontWeight: 600`, `fontSize: '0.75rem'`, `textTransform: 'uppercase'`), 홀수행 얼룩무늬(`action.hover`), Outlined `StatusChip`
  - 프론트엔드 파라미터 편집 UI: `backstage/plugins/spring-batch-dashboard/src/components/ExecuteJobPage/ExecuteJobPage.tsx`의 Key/Value Grid Row 패턴
  - 백엔드 스케줄러: `com.github.kagkarlsson.scheduler.ScheduledExecution`의 `getLastSuccess()`, `getLastFailure()`, `isPicked()`
  - 백엔드 Job 메타데이터: Spring Batch `JobRegistry`, `JobExplorer` (`getJobInstanceCount`, `getLastJobInstance`, `getLastJobExecution`)
  - 기존 설계 문서: `docs/design/20260930_schedule_management.md`

## 구현 대상 명세
| 대상 유형 | 파일/패키지 경로 | 클래스/컴포넌트명 | 주요 역할 및 설명 |
|---|---|---|---|
| 수정 (Frontend) | `backstage/packages/app/src/modules/nav/Sidebar.tsx` | `SidebarContent` | 기존 `page:spring-batch-dashboard`를 `take` 처리하고, `Spring Batch` 아이템을 `/platform/batch/schedules`로 연결 |
| 수정 (Backend) | `ingestion/src/main/java/io/slim/workflow/app/adapter/scheduler/WorkflowScheduleData.java` | `WorkflowScheduleData` | 등록일(`Instant createdAt`) 필드 추가 (생성 시점 기록) |
| 수정 (Backend) | `ingestion/src/main/java/io/slim/batch/console/scheduler/JobSchedulerRepository.java` | `JobSchedulerRepository.ScheduleDto` | `createdAt`, `lastExecutionTime`, `lastStatus` 필드 추가 |
| 수정 (Backend) | `ingestion/src/main/java/io/slim/batch/console/scheduler/DbJobSchedulerRepository.java` | `DbJobSchedulerRepository` | `findAll()` 시 `ScheduledExecution`의 `lastSuccess`, `lastFailure`, `isPicked` 및 payload의 `createdAt` 매핑 |
| 수정 (Backend) | `ingestion/src/main/java/io/slim/batch/console/web/BatchConsoleController.java` | `BatchConsoleController` | `JobExplorer`를 주입받아 `/api/batch/jobs`에서 Job 상세 메타데이터(`BatchJobDto` 리스트) 반환 |
| 수정 (Frontend) | `backstage/plugins/batch-console/src/api/BatchConsoleApi.ts` | `BatchConsoleApi`, `BatchConsoleApiClient` | `BatchJobDto` 타입 및 API 메서드 갱신 |
| 수정 (Frontend) | `backstage/plugins/batch-console/src/components/SchedulePage.tsx` | `SchedulePage` | 상단 헤더 주석, Create 버튼 우측 배치, SpringBatchPage 표 스타일, YAML DetailPanel, 신규 컬럼, Run 모달 및 링크 Action |
| 신규/수정 (Frontend) | `backstage/plugins/batch-console/src/components/BatchJobsPage.tsx` (기존 BatchConsolePage) | `BatchJobsPage` | 리네이밍, 헤더 주석, SpringBatchPage 표 스타일, JobExplorer 기반 컬럼 및 Run/History 액션 |
| 수정 (Frontend) | `backstage/plugins/batch-console/src/plugin.tsx` / `routes.ts` / `index.ts` | 라우트 및 플러그인 정의 | `BatchJobsPage` export 및 연결 (하위 호환 alias 유지) |
| 수정 (Frontend Test) | `backstage/plugins/batch-console/src/components/SchedulePage.test.tsx` / `BatchJobsPage.test.tsx` | 테스트 | 신규 컬럼 렌더링, 액션 버튼, 변경된 컴포넌트명 테스트 갱신 |
| 수정 (Backend Test) | `ingestion/src/test/java/io/slim/batch/console/...` | 단위/통합 테스트 | DTO 필드 확장 및 Controller 응답 검증 갱신 |

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 사이드바 메뉴 링크 교체 | `Sidebar.tsx`에서 `nav.take('page:spring-batch-dashboard')` 후 `/platform/batch/schedules`로 `SidebarItem` 등록 | 사용자의 요구: 사이드바의 Spring Batch 클릭 시 스케줄 관리 페이지로 바로 연결 |
| 등록일(Created At) 영속화 | `WorkflowScheduleData` payload에 `Instant createdAt` 보존 | `db-scheduler` 기본 테이블(`scheduled_tasks`)에 `created_at` 컬럼이 없으므로 직렬화 데이터 객체에 포함 |
| 마지막 실행시간/상태 기준 | `ScheduledExecution`의 `getLastSuccess()`, `getLastFailure()`, `isPicked()` 기반 계산 | 사용자의 결정: 스케줄 기준 상태 판별. (1) `isPicked()` -> RUNNING, (2) 최근 시각 비교 -> SUCCESS/FAILED, (3) 기록 없음 -> null |
| 표 스타일 및 래핑 | `InfoCard` 래핑, `SpringBatchPage.tsx` 스타일 적용 | 헤더(`fontWeight: 600`, 대문자, 자간 0.5px), 줄무늬(`action.hover`), Outlined `StatusChip` 적용으로 일관된 룩앤필 제공 |
| 파라미터 YAML 출력 방식 | 행 클릭 시 펼쳐지는 Collapse Row (또는 DetailPanel) | 사용자의 결정: 옵션 A(행 바로 아래 확장). 클릭 시 해당 행 하단에 YAML 뷰어 토글 |
| 상대 시간(xxx ago) 규칙 | 15일 이내: 상대시간(방금, n분 전, n시간 전, n일 전) / 15일 초과: `YYYY-MM-DD HH:mm` | 사용자의 결정: 15일 기준 분기. 외부 헤비 라이브러리 추가 없이 경량 포맷 함수 적용 |
| Run Dialog & 파라미터 UI | `maxWidth="md"`, `ExecuteJobPage.tsx`의 Grid(Key 5 : Value 6 : Delete 1) 레이아웃 적용 | 사용자의 피드백: 기존 화면의 직관성 부족 개선 및 넉넉한 다이얼로그 너비 확보 |
| 실행이력 바로보기 링크 | Backstage의 `/spring-batch` 경로로 `Link` 연결 | 사용자의 결정: `/spring-batch` 메인 대시보드로 직접 라우팅 |
| 즉시 실행(Run) 동작 | `batchConsoleApiRef.runJob(jobName, params)` 호출 | 스케줄 설정 변경 없이 일회성 ad-hoc 배치 실행 수행 |
| Job 메타데이터 컬럼 | `JobExplorer` 연동 (`Restartable`, `Total Runs`, `Last Status`, `Last Run`) | 사용자의 결정: Spring Batch Job 인스턴스 및 최근 실행 이력을 조회하여 표에 제공 |

## 데이터 모델

### Backend: `ScheduleDto`
```java
public record ScheduleDto(
    String id,
    String jobName,
    String cronExpression,
    Map<String, String> parameters,
    Instant createdAt,
    Instant lastExecutionTime,
    String lastStatus // "SUCCESS" | "FAILED" | "RUNNING" | null
) {}
```

### Backend: `BatchJobDto`
```java
public record BatchJobDto(
    String name,
    boolean restartable,
    boolean hasSchema,
    int totalExecutions,
    String lastStatus,       // "COMPLETED" | "FAILED" | "STARTED" | null
    Instant lastExecutionTime
) {}
```

### Frontend: `ScheduleItem`
```typescript
interface ScheduleItem {
  id: string;
  jobName: string;
  cronExpression: string;
  parameters: Record<string, string>;
  createdAt?: string | null;
  lastExecutionTime?: string | null;
  lastStatus?: 'SUCCESS' | 'FAILED' | 'RUNNING' | null;
}
```

### Frontend: `BatchJobItem`
```typescript
interface BatchJobItem {
  name: string;
  restartable: boolean;
  hasSchema: boolean;
  totalExecutions: number;
  lastStatus?: 'COMPLETED' | 'FAILED' | 'STARTED' | null;
  lastExecutionTime?: string | null;
}
```

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과:
  - `./gradlew :ingestion:compileJava` 통과
  - `yarn --cwd backstage/plugins/batch-console build` 및 `tsc` 통과
- [ ] 단위/통합 테스트 통과:
  - 백엔드: `./gradlew :ingestion:test --tests "*BatchConsole*" --tests "*Schedule*"` 통과
  - 프론트엔드: `yarn --cwd backstage/plugins/batch-console test` 통과
- [ ] UI 검증:
  - **SchedulePage**:
    - 상단 Schedules Header 주석 처리 확인
    - Create 버튼 우측 배치 확인
    - Row 클릭 시 DetailPanel에 parameters YAML 포맷 노출 확인
    - Created At, Last Run, Last Status 컬럼 표시 및 15일 상대시간 동작 확인
    - Actions에 Run 아이콘 클릭 시 파라미터 초기화된 다이얼로그 오픈 및 즉시 실행 호출 확인
    - Actions에 History 아이콘 클릭 시 `/spring-batch` 이동 링크 확인
  - **BatchJobsPage**:
    - 파일/컴포넌트 리네이밍(`BatchJobsPage`) 및 상단 헤더 주석 처리 확인
    - `Job Name`, `Restartable`, `Total Runs`, `Last Status`, `Last Run`, `Actions` 컬럼 정상 렌더링 확인
    - `SpringBatchPage` 일관된 룩앤필(`InfoCard`, Outlined StatusChip 등) 적용 확인
  - **Sidebar**:
    - 사이드바의 `Spring Batch` 메뉴 클릭 시 `/platform/batch/schedules`로 정상 라우팅 확인
