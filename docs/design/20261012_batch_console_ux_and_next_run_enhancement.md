# Batch Console Next Fire Time 노출, 삭제 확인 모달 및 에러 Fallback 개선 설계 스펙

## 목표
선행 아키텍처 과제(SPI 표준화, GitOps 정책, Catalog Resource 및 RBAC, Execution Stop API, Starter 모듈화)를 제외한 현행 시스템의 필수 구현 잔여 과제 3건을 해결한다:
1. **스케줄 다음 실행 예정 시간(Next Fire Time) 계산/반환 및 UI 노출**: 스케줄 조회 시 다음 실행 시각을 제공하여 운영 가시성을 확보한다.
2. **파괴적 액션(스케줄 삭제) 안전장치 추가**: 스케줄 삭제 시 확인 다이얼로그(Confirmation Dialog)를 제공하여 오동작 및 실수에 의한 스케줄 삭제를 방지한다.
3. **타깃 배치 서버 장애 시 Fallback UI 보강**: 타깃 배치 서버 다운 또는 중계 에러(502/Network Error) 발생 시 화면 크래시나 빈 화면 대신 재시도(Retry) 가능한 표준 `ResponseErrorPanel` 화면을 렌더링한다.

---

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**:
  - 스케줄 저장소: `ingestion` 모듈의 `DbJobSchedulerRepository` (kagkarlsson `db-scheduler` 기반)
  - 테이블 뷰 컴포넌트: `backstage/plugins/batch-console` 내 `ScheduleView.tsx`, `BatchJobsView.tsx`
  - 시간 포맷팅: `formatRelativeOrAbsoluteTime` (`common.tsx`)
  - 오류 컴포넌트: Backstage 코어 컴포넌트 `@backstage/core-components`의 `ResponseErrorPanel`
- **신규/개선 이유**:
  - `ScheduledExecution.getExecutionTime()`으로 이미 다음 실행 시각이 db-scheduler 내부에 존재하나 `ScheduleDto`에 매핑되지 않아 사용자에게 보이지 않음.
  - `ScheduleView.tsx`의 휴지통 아이콘 클릭 시 별도 컨펌 없이 `api.cancelSchedule()`이 즉각 호출되어 삭제 실수의 위험이 큼.
  - `BatchJobsView` 및 `ScheduleView`에서 `useAsyncRetry`의 `error` 필드를 무시하고 있어, 서버 장애 시 빈 목록으로 오인되거나 원인 파악이 어려움.

---

## 필요 값 정의
| 값 이름 | 성격 | 기원 | 유효 범위 / 단위 | 적용 조건 / 확정 시점 |
|---|---|---|---|---|
| `execution.getExecutionTime()` | 계산값 | `com.github.kagkarlsson.scheduler.ScheduledExecution` | `Instant` (UTC/Epoch) | 스케줄 등록/갱신 시 db-scheduler가 계산, 목록 조회 시 추출 |
| `nextExecutionTime` | 전달값 | Backend API -> Frontend DTO | ISO-8601 String / `Instant` | 스케줄 목록 API(`GET /api/batch/schedules`) 응답 시 확정 |
| `deleteConfirmOpen` | UI 상태값 | `ScheduleView.tsx` 내부 State | `boolean` (기본값 `false`) | 사용자가 삭제 아이콘 클릭 시 `true`, 취소/완료 시 `false` |
| `deletingSchedule` | UI 상태값 | `ScheduleView.tsx` 내부 State | `ScheduleItem \| null` | 삭제 대상 스케줄 객체 |
| `error` | UI 상태값 | `useAsyncRetry` 훅 결과값 | `Error \| undefined` | 백엔드 API 호출 실패 시 확정 |

---

## 구현 대상 명세

| 대상 유형 | 파일/패키지 경로 | 클래스/컴포넌트/인터페이스명 | 주요 역할 및 설명 |
|---|---|---|---|
| **수정** | `ingestion/src/main/java/io/slim/batch/console/scheduler/JobSchedulerRepository.java` | `JobSchedulerRepository.ScheduleDto` | `Instant nextExecutionTime` 필드 추가 |
| **수정** | `ingestion/src/main/java/io/slim/batch/console/scheduler/DbJobSchedulerRepository.java` | `DbJobSchedulerRepository` | `findAll()`에서 `execution.getExecutionTime()`을 추출하여 DTO에 매핑 |
| **수정** | `ingestion/src/test/java/io/slim/batch/console/scheduler/DbJobSchedulerRepositoryTest.java` | `DbJobSchedulerRepositoryTest` | `findAll` 시 `nextExecutionTime` 매핑 검증 테스트 케이스 추가 |
| **수정** | `backstage/plugins/batch-console/src/api/BatchConsoleApi.ts` | `ScheduleItem` 인터페이스 | `nextExecutionTime?: string \| null;` 필드 추가 |
| **수정** | `backstage/plugins/batch-console/src/components/ScheduleView.tsx` | `ScheduleView` 컴포넌트 | 1. 테이블 헤더에 `Next Run` 추가<br>2. `deleteConfirmOpen` 상태 및 삭제 확인 Dialog 추가<br>3. `error` 발생 시 `ResponseErrorPanel` 및 Retry 버튼 렌더링 |
| **수정** | `backstage/plugins/batch-console/src/components/BatchJobsView.tsx` | `BatchJobsView` 컴포넌트 | `error` 발생 시 `ResponseErrorPanel` 및 Retry 버튼 렌더링 |
| **수정** | `backstage/plugins/batch-console/src/components/ScheduleView.test.tsx` | `ScheduleView.test.tsx` | 신규 `Next Run` 헤더 순서 및 삭제 Confirm 모달 상호작용 검증 반영 |
| **수정** | `backstage/plugins/batch-console/src/components/BatchJobsView.test.tsx` | `BatchJobsView.test.tsx` | 에러 Fallback 렌더링 테스트 케이스 추가 |

---

## 설계 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| **배달 보장** | 스케줄 삭제는 At-most-once (멱등 연산) | 취소 API(`cancelSchedule`)는 존재하지 않는 ID 요청에도 안전하게 멱등 처리됨 |
| **동시성 제어** | 낙관적 UI 차단 (Confirm 중복 클릭 방지) | 삭제 진행 중(`deleting: boolean`) 다이얼로그 확인 버튼 비활성화 처리 |
| **실패/재시도** | UI 레벨 Retry 버튼 제공 | 백엔드 장애 복구 후 페이지 전체 새로고침 없이 `retry()` 함수를 즉시 호출 가능하도록 `ResponseErrorPanel`과 함께 노출 |
| **서브모듈/소비자 영향도** | Backend DTO 변경은 하위 호환성 유지 | `ScheduleDto`에 `nextExecutionTime`이 추가되어도 기존 JSON 직렬화는 필드 추가이므로 기존 소비자(Front)에 Breaking change 없음 |
| **데이터 모델** | `ScheduleItem.nextExecutionTime` (nullable) | 미실행/취소 또는 스케줄러 상태에 따라 null 가능 |
| **파라미터 시간 결합** | 상대 시간 기반 다음 실행 시각 | `ScheduledExecution.getExecutionTime()`은 UTC `Instant`로 저장되며, 프론트엔드에서 `formatRelativeOrAbsoluteTime`으로 사용자의 로컬 타임존 및 상대시간("in 2 hours", "Tomorrow at ...")으로 변환 표시 |

---

## 상세 변경 명세

### 1. Backend (`ingestion`)
#### (1) `ScheduleDto` 레코드 필드 추가
```java
public record ScheduleDto(
    String id,
    String jobName,
    String cronExpression,
    Map<String, String> parameters,
    Instant createdAt,
    Instant lastExecutionTime,
    String lastStatus,
    Instant nextExecutionTime // 신규 추가
) {}
```
#### (2) `DbJobSchedulerRepository.findAll()` 매핑
```java
Instant nextExecutionTime = execution.getExecutionTime();

result.add(new ScheduleDto(
    id,
    wsd.content().name(),
    wsd.content().cron(),
    wsd.content().props(),
    createdAt,
    lastExecutionTime,
    lastStatus,
    nextExecutionTime // 매핑 추가
));
```

---

### 2. Frontend (`batch-console`)
#### (1) `ScheduleItem` 인터페이스
```typescript
export interface ScheduleItem {
  id: string;
  jobName: string;
  cronExpression: string;
  parameters: Record<string, string>;
  createdAt?: string | null;
  lastExecutionTime?: string | null;
  lastStatus?: 'SUCCESS' | 'FAILED' | 'RUNNING' | null;
  nextExecutionTime?: string | null; // 신규 추가
}
```

#### (2) `ScheduleView.tsx` 테이블 컬럼 순서
사용자 인지 흐름(Job -> 주기 -> 다음 예정 -> 최근 상태 -> 최근 실행 -> 등록일시 -> 작업)에 맞춘 최적 순서:
1. `Job Name`
2. `Cron Expression`
3. `Next Run` (신규: `formatRelativeOrAbsoluteTime(row.nextExecutionTime)`)
4. `Last Status`
5. `Last Run`
6. `Created At`
7. `Actions`

#### (3) 스케줄 삭제 Confirm Dialog 구현
- `IconButton aria-label="Delete ${row.jobName}"` 클릭 시:
  - `setDeletingSchedule(row)`
  - `setDeleteConfirmOpen(true)`
- Confirm Dialog:
  - Title: `"Cancel Schedule"`
  - Content: `"Are you sure you want to cancel the schedule for '${deletingSchedule.jobName}' (${deletingSchedule.cronExpression})? This action cannot be undone."`
  - Actions:
    - `"Keep Schedule"` (취소 버튼) -> 모달 닫기
    - `"Delete"` (위험 강조 빨간색 버튼) -> `handleConfirmDelete()` 호출 -> `api.cancelSchedule()` 실행 및 alert 알림, `retry()` 갱신

#### (4) 에러 Fallback 화면 (`BatchJobsView.tsx` & `ScheduleView.tsx`)
```tsx
const { value: jobs, loading, error, retry } = useAsyncRetry(...);

if (error) {
  return (
    <InfoCard title="Spring Batch Jobs">
      <ResponseErrorPanel error={error} />
      <Box mt={2}>
        <Button variant="outlined" color="primary" onClick={() => retry()}>
          Retry
        </Button>
      </Box>
    </InfoCard>
  );
}
```

---

## 완료 조건 (자가검증)
- [ ] **빌드 및 컴파일**:
  - `ingestion`: `./gradlew test` 통과
  - `backstage`: `yarn workspace @internal/backstage-plugin-batch-console test` 통과
  - `backstage`: `yarn tsc` 오류 없음 검증
- [ ] **유닛테스트 시나리오**:
  - `DbJobSchedulerRepositoryTest`: `findAll` 시 `nextExecutionTime`이 올바르게 반환되는지 검증
  - `ScheduleView.test.tsx`:
    - `Next Run` 테이블 헤더 및 값 렌더링 검증
    - 삭제 버튼 클릭 시 Confirm 다이얼로그가 표시되는지 검증
    - Confirm 다이얼로그의 삭제 버튼 클릭 시 `api.cancelSchedule`이 호출되는지 검증
    - 취소 버튼 클릭 시 다이얼로그가 닫히고 API가 호출되지 않는지 검증
    - `error` 발생 시 `ResponseErrorPanel` 렌더링 검증
  - `BatchJobsView.test.tsx`:
    - `error` 발생 시 `ResponseErrorPanel` 및 Retry 버튼 노출 검증

---

## 미결 사항
- 없음 (1번 전체 아키텍처, Execution Stop API, Starter 모듈화, Catalog RBAC 및 Identity 검증은 사용자 지시에 따라 차기 TODO로 분리 확정).
