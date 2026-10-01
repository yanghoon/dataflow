# Backstage Spring Batch Console 플러그인 API 설계 스펙

## 가정 (Assumptions)
사용자의 명시적 요구로 인해 스펙에서 누락된 품질 게이트 항목들을 다음 가정으로 대체하고 구현을 진행합니다.
- **배달/일관성 보장**: 수동 실행 API는 Spring Batch의 `JobLauncher` 기본 설정(`TaskExecutor`)에 의존하며, API 응답은 Job의 큐잉 또는 실행 시작 성공만을 반환하고 최종 완료를 동기적으로 기다리지 않음.
- **동시성 제어**: 중복 Job 실행 시 발생하는 `JobExecutionAlreadyRunningException` 및 `JobInstanceAlreadyCompleteException`은 HTTP 409 Conflict로 변환하여 에러 응답 처리.
- **실패 처리**: 서버 예외 발생 시 프론트엔드에서는 Alert/Snackbar로 오류 메시지를 노출하며, 재시도/DLQ는 스코프에서 제외.
- **테스트 전략**: Backend는 단위(Mock 사용)와 통합(실제 Spring/DB 연동)으로 나누어 검증. Frontend는 `@testing-library/react`로 렌더링 및 상태 검증.
- **Mock 경계 검증**: Backend 통합 테스트(`*IntegrationTest.java`)에서 메모리 DB를 사용해 실제 Spring Batch 메타데이터 통신과 JobLauncher 배선을 검증.
- **테스트 파일 분리**: Backend는 `*Test.java`와 `*IntegrationTest.java`로 테스트 파일을 분리. Frontend는 `*.test.tsx`로 컴포넌트와 같은 디렉토리에 위치.

## 목표
- **Backend (Spring Boot)**: 향후 서브모듈 분리를 고려하여 독립적인 Spring Batch Console API(`io.slim.batch.console`)를 개발한다.
- **Frontend (Backstage Plugin)**: 새로 작성된 API를 연동하여 Job 목록 조회 및 수동 실행 기능을 제공하는 Backstage 프론트엔드 플러그인을 개발한다.
- **제외 스코프**: Job 실행 이력 조회, Job 중지 기능, API 인증 처리는 당장 구현하지 않는다.

## 배경 / 기존 컨텍스트
- **API (Java)**: 기존 `ingestion` 모듈 내 `AdminJobController`에 있던 파라미터 스키마 렌더링 로직(`SchemaAwareValidator` 등)을 재사용하되, 완전히 독립적인 패키지로 분리.
- **Frontend (Backstage)**: 기존 `spring-batch-dashboard`와 분리된 새로운 요구사항(RJSF 기반 동적 폼)을 충족하기 위해, 플러그인을 신규 작성하거나 확장한다.

## 1. Backend (Spring Boot) 구현 명세

| 대상 유형 | 파일/패키지 경로 | 클래스명 | 주요 역할 |
|---|---|---|---|
| 신규 | `ingestion/src/main/java/io/slim/batch/console/config/BatchConsoleAutoConfiguration.java` | `BatchConsoleAutoConfiguration` | `io.slim.batch.console` 스캔 및 빈 등록 (자동 구성) |
| 신규 | `ingestion/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` | `AutoConfiguration.imports` | Spring Boot 3 자동 구성 모듈 로드 설정 |
| 신규 | `ingestion/src/main/java/io/slim/batch/console/web/BatchConsoleController.java` | `BatchConsoleController` | Job 목록, 스키마, 수동 실행 통합 API (Base Path: `/api/batch`) |
| 신규 | `ingestion/src/main/java/io/slim/batch/console/validation/SchemaAwareValidator.java` | `SchemaAwareValidator` | 기존 로직 복사 + Swagger Module 연동(ModelConverters)으로 RJSF용 JSON 스키마 반환 |

## 2. Frontend (Backstage Plugin) 구현 명세

컴포넌트 이름 및 구조는 Backstage의 표준 컨벤션을 따르며, Dialog 대신 하위 라우팅 페이지를 사용합니다.

| 대상 컴포넌트 | 역할 및 UI 요건 |
|---|---|
| **BatchConsoleApiClient** | Backstage `discoveryApi`와 `fetchApi`를 주입받아 Proxy 플러그인(`proxy`)을 경유하여 백엔드와 통신하는 API 클라이언트 |
| **BatchConsolePage** | 라우팅 기준 경로: `/platform/batch/jobs`<br>별도의 컴포넌트 분리 없이 내부에서 `<Table>`을 사용하여 `BatchConsoleApi`를 통해 받아온 Job 목록(`getJobNames`) 렌더링. 특정 Job 클릭 시 `JobRunPage`로 라우팅. |
| **JobRunPage** | 라우팅 경로: `/platform/batch/jobs/:jobName`<br>Job 실행 화면 전체를 담당하는 페이지. 하위에 `JobRunForm`을 포함 |
| **JobRunForm** | **[핵심]** 스키마 지원 여부에 따라 입력 폼을 렌더링하고 `BatchConsoleApi.runJob(params)`을 호출<br> - **Schema Mode**: 백엔드에서 JSON Schema가 오면 `@rjsf/mui`로 동적 폼 렌더링<br> - **Fallback Mode**: 스키마 미지원 시 Key-Value 형태의 Map 기반 UI(동적 추가 가능한 텍스트 필드) 렌더링<br> *(어느 방식이든 제출 시 동일한 수동 실행 API 요청으로 변환됨)* |

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 통신 및 라우팅 | **Proxy Plugin** & **DiscoveryApi** 활용 | Backstage의 권장 백엔드 통신 패턴 준수. CORS 및 인증 프록싱 문제를 Proxy 플러그인으로 위임 |
| UI 구조 단순화 | Dialog 대신 서브 라우팅(`/:jobName`), 별도 Table 컴포넌트 제거 | 단일 페이지 내 단순 `<Table>` 사용으로 복잡도 제거 및 페이지 간 명확한 URL 탐색(딥링킹) 제공 |
| 프론트엔드 UI | Backstage Design System 및 RJSF 활용 | `@backstage/core-components`를 적극 활용하여 통일감 유지 |
| 시간 파라미터 결합 | 프론트엔드는 사용자 입력 파라미터만 전송, API 내부에서 `startTime` 주입 | 서버 기준으로 정확한 배치 실행 시간 보장 (클라이언트 시간 의존 탈피) |

## 완료 조건 (자가검증)
- [ ] **Backend**: `/api/batch` 엔드포인트 컴파일/테스트 통과 및 AutoConfiguration 정상 로드
- [ ] **Frontend**: `/platform/batch/jobs` 접속 시 Table 목록 출력 및 `discoveryApi` + Proxy 연동 통신 확인
- [ ] **Integration**:
    - Table에서 특정 Job 클릭 시 `/platform/batch/jobs/:jobName`으로 정상 이동
    - RJSF 폼과 Fallback Map 폼 양쪽 모두 동일한 수동 실행 동작을 정상적으로 수행하는지 확인
