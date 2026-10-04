# Batch Console 멀티 인스턴스 지원 설계 스펙

## 목표
동일한 설정 구조(`springBatch.databases`)를 공유하여 여러 배치 인스턴스(환경)를 지원하도록, HTTP 중계 기능의 `batch-console-backend` 플러그인을 신규 구현하고 `batch-console` 프론트엔드를 멀티 인스턴스 지원 구조로 개선한다.

## 필요 값 정의
| 값 이름 | 성격 | 기원 | 유효 범위 / 단위 | 적용 조건 / 확정 시점 |
|---|---|---|---|---|
| `springBatch.databases` | 설정값 | `app-config.yaml` | Record<string, InstanceConfig> | 백엔드 부팅 시 로드 |
| `springBatch.defaultEnvironment` | 설정값 | `app-config.yaml` | string (미설정 시 첫 번째 인스턴스 키) | 백엔드 부팅 시 로드 |
| `databases.<env>.http.url` | 설정값 | `app-config.yaml` | 유효한 HTTP URL | 백엔드 부팅 시 로드 |
| `databases.<env>.http.headers` | 설정값 | `app-config.yaml` | Record<string, string> (Optional) | 백엔드 부팅 시 로드 |
| Target Base URL | 계산값 | `new URL(url).origin + '/api/batch'` | URL string | 요청 중계 시 동적 계산 |
| `environment` | 동적 파라미터 | HTTP Query (`?environment=...`) | 기설정된 인스턴스 식별자 | API 호출 시점 확정 |

## 1. 신규 생성 파일 및 의존성

### 위치: `backstage/plugins/batch-console-backend/`
| 파일 경로 | 주요 역할 |
|---|---|
| `package.json` | 패키지 정의 (`@internal/backstage-plugin-batch-console-backend`) 및 최소 의존성 |
| `tsconfig.json` | TypeScript 설정 (`../../tsconfig.json` extends) |
| `src/index.ts` | 플러그인 export (`batchConsolePlugin as default`) |
| `src/plugin.ts` | `createBackendPlugin` 등록 및 라우터 마운트 |
| `src/service/router.ts` | 인스턴스 목록 제공(`GET /environments`) 및 인스턴스별 `/api/batch` HTTP 요청 중계 |
| `src/service/router.test.ts` | 중계 라우팅 및 인스턴스 목록 유닛 테스트 |

### 필요 의존성
- **dependencies**: `@backstage/backend-plugin-api`, `@backstage/config`, `express` (Node 내장 `fetch` 사용, DB 라이브러리 없음)
- **devDependencies**: `@backstage/cli`, `@backstage/backend-test-utils`, `@types/express`, `supertest`, `@types/supertest`

---

## 2. 기존 파일 수정 명세

### (1) Backend 앱 연결
- `backstage/packages/backend/package.json`: `@internal/backstage-plugin-batch-console-backend` 의존성 추가
- `backstage/packages/backend/src/index.ts`: 백엔드 플러그인 등록 (`/api/batch-console` 마운트)

### (2) Frontend 플러그인 (`batch-console`)
- `backstage/plugins/batch-console/src/api/BatchConsoleApi.ts`:
  - 엔드포인트를 백엔드 플러그인(`discoveryApi.getBaseUrl('batch-console')`)으로 변경
  - `getEnvironments()` 추가
  - 모든 API에 `environment?: string` 파라미터 추가하여 백엔드로 전달
- `backstage/plugins/batch-console/src/components/BatchConsolePage.tsx`:
  - `api.getEnvironments()` 호출 및 URL 쿼리 파라미터(`?environment=...`) 연동
  - 상단 툴바에 인라인 ButtonGroup(인스턴스 토글) 추가 (별도 컴포넌트 파일 생성 없이 최소 구현)
  - 하위 뷰에 `environment` prop 전달
- `backstage/plugins/batch-console/src/components/BatchJobsView.tsx`: `environment` prop 수신 및 변경 시 재조회
- `backstage/plugins/batch-console/src/components/ScheduleView.tsx`: `environment` prop 수신 및 해당 인스턴스 기준으로 스케줄 관리
- `backstage/plugins/batch-console/src/components/RunJobDialog.tsx`: `environment` prop 수신 후 Job 실행 요청 시 전달
- `backstage/plugins/batch-console/src/components/JobRunPage.tsx`: URL 쿼리 파라미터 `environment` 전달

---

## 3. 백엔드 라우터 세부 스펙 (`service/router.ts`)

### 엔드포인트 규칙
- `GET /environments`: `{ environments: string[], defaultEnvironment: string }`
- `GET /jobs`: 대상 인스턴스의 `${origin}/api/batch/jobs`로 중계
- `GET /jobs/:jobName/schema`: 대상 인스턴스의 `${origin}/api/batch/jobs/:jobName/schema`로 중계
- `POST /jobs/:jobName/executions`: 대상 인스턴스의 `${origin}/api/batch/jobs/:jobName/executions`로 중계
- `GET /schedules`: 대상 인스턴스의 `${origin}/api/batch/schedules`로 중계
- `POST /schedules`: 대상 인스턴스의 `${origin}/api/batch/schedules`로 중계
- `PUT /schedules/:id`: 대상 인스턴스의 `${origin}/api/batch/schedules/:id`로 중계
- `DELETE /schedules/:id`: 대상 인스턴스의 `${origin}/api/batch/schedules/:id`로 중계

### 인스턴스 Base URL 도출
`springBatch.databases.<env>.http.url`의 origin 추출 후 `/api/batch` 결합. 헤더 설정 존재 시 포함 전달.

---

## 4. 완료 조건 및 실행 검증 절차 (Verification Plan)

### (1) 정적 검증 및 유닛 테스트
- [ ] `yarn tsc` 오류 없음 검증
- [ ] `batch-console-backend` 유닛테스트 통과 (`yarn workspace @internal/backstage-plugin-batch-console-backend test`)
  - `GET /environments`: 설정된 환경 목록 및 기본 환경 반환 검증
  - `GET /jobs?environment=dev`: 대상 인스턴스(`${origin}/api/batch/jobs`)로 중계 호출 및 200 응답 검증
  - 미등록 환경 요청 시 400 Bad Request 반환 검증

### (2) 백엔드 & 프론트엔드 실제 실행 통합 검증
- [ ] **실행 준비**:
  1. 배치 대상 인스턴스(Spring Boot `ingestion` 모듈) 실행 확인 (포트 8080)
  2. Backstage 전체 구동: `cd backstage && yarn start`
- [ ] **화면 및 동작 E2E 검증**:
  1. 브라우저에서 `http://localhost:3000/platform/batch/jobs` 접속
  2. 상단 툴바에 설정에 정의된 인스턴스 토글 버튼(`dev` 등)이 정상 렌더링되는지 확인
  3. 인스턴스 버튼 클릭 시 URL에 `?environment=<선택값>`이 반영되고 목록이 즉시 갱신되는지 확인
  4. 브라우저 개발자도구 Network 탭에서 `/api/batch-console/jobs?environment=dev` 호출 및 200 OK 확인 (기존 `/spring-batch/api/batch` 호출이 사라졌는지 검증)
  5. 특정 Job의 "Run" 버튼 클릭 후 실행 다이얼로그에서 실행 요청 시 대상 인스턴스로 정상 실행(`POST /api/batch-console/jobs/:jobName/executions?environment=dev`)되는지 확인
  6. "Scheduled" 탭으로 이동하여 현재 인스턴스의 스케줄 목록 조회 및 신규 스케줄 생성이 정상 동작하는지 확인
