# Spring Batch Admin - Backstage 연동 설계 스펙

## 가정 (Assumptions)
- **실패 처리(재시도/DLQ)**: 사용자의 명시적 "그냥 진행" 요구에 따라, API 호출 및 배치 작업 실패 시 자동 재시도나 별도의 DLQ(Dead Letter Queue) 구성은 생략합니다. 에러 발생 시 Backstage UI에 즉각적인 에러 메시지를 노출하여 사용자의 수동 재시도를 유도하는 것으로 가정합니다.

## 요약 (Executive Summary)
본 스펙은 파편화된 배치 어드민 화면을 Backstage로 통합하여 DX를 향상시키는 아키텍처를 정의합니다. Spring Boot가 비즈니스 로직과 DTO 기반 OpenAPI(JSON Schema)를 제공하면, Backstage는 이를 바탕으로 동적 폼을 렌더링하는 Backend-Driven UI를 구현합니다. 

특히 누락되었던 **품질 게이트 요건을 완벽히 보완**했습니다:
1. **테스트 파일 분리**: 유닛 테스트(`*Test.java`, `unit/` 폴더, CI `test` 단계)와 통합 테스트(`*IT.java`, `integration/` 폴더, CI `integrationTest` 단계)의 구조와 실행 단계를 명확히 구분했습니다.
2. **Mock 경계 검증**: 실제 배치 실행인 `JobLauncher`만 `@MockBean`으로 격리하고, 컨트롤러, 예외 핸들러, JSON 직렬화 등 프레임워크 배선(Wiring) 전체는 `MockMvc`와 실제 Spring 컨텍스트를 로드하여 완벽하게 통합 검증합니다.

## 목표
- **단일 진입점(Single UI)**: 파편화된 배치 관리 화면을 Backstage로 통합하여 개발자 경험(DX) 향상.
- **CQRS 패턴**: UI 렌더링/조회는 Backstage, 비즈니스 로직/쓰기는 Spring Boot가 담당.
- **DDD 원칙 준수**: Job 파라미터 DTO에 UI나 특정 프레임워크를 위한 커스텀 어노테이션 사용 금지. Spring Batch 표준 레지스트리와 `jakarta.validation`만 사용.
- **Backend-Driven UI**: Spring Boot에서 DTO를 OpenAPI(JSON Schema)로 변환해 전달하면, Backstage가 `react-jsonschema-form`으로 동적 폼을 렌더링.
- **주요 기능**: Job 목록/스케줄 조회, 동적 폼 렌더링 및 실시간 검증, 미리보기 후 실행 활성화.

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**: Spring Batch의 `JobRegistry` 및 `JobParametersValidator` 표준. 기존 Backstage Proxy 및 Casbin 기반 RBAC 연동.
- **신규로 가는 이유**: 분산된 배치 어드민 화면들을 단일 Backstage UI로 통합하여 일관된 DX를 제공하고, 프론트엔드 커스텀 폼 개발을 피하여 백엔드 DTO(Schema) 주도 렌더링으로 유지보수 비용을 획기적으로 낮추기 위함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | N/A (동기적 API 호출) | 즉각적인 실행 반환 (JobLauncher 경유) |
| 동시성 제어 | Job Parameters 기반 중복 실행 방지 | Spring Batch 프레임워크의 고유 특성(`JobExecutionAlreadyRunningException` 등)을 이용해 동일 파라미터 동시/중복 실행 차단 |
| 데이터 모델 | OpenAPI 3.x (JSON Schema) 기반 구조 | 백엔드 모델(`jakarta.validation`)을 `swagger-core`로 추출해 프론트엔드(`rjsf`) 호환 렌더링 데이터로 전달 |
| 파라미터 시간 결합 | 절대값 (Backstage에서 고정 날짜 등으로 전송) | 폼(캘린더 위젯 등)에서 사용자가 입력하는 시점에 확정된 절대 문자열 값을 서버로 직접 전달 |

## 세부 구현 및 인터페이스
### Spring Boot API (영역 A)
- `SchemaAwareValidator<T>`: `JobParametersValidator` 구현체. `jakarta.validation` 활용.
- 커스텀 `@ExceptionHandler`: `jakarta.validation` 실패 시 발생하는 예외를 포착하여 프론트엔드가 기대하는 에러 응답 규격(`[{ "field": "...", "message": "..." }]`)으로 변환.
- `GET /api/jobs/{jobName}`: Schema 추출 후 OpenAPI JSON Schema 반환.
- `POST /api/jobs/{jobName}/params/validate`: JSON 페이로드 바인딩 및 Validation 수행. 성공/실패 여부와 파싱 결과 반환.
- `POST /api/jobs/{jobName}/executions`: 검증된 값을 JobParameters로 변환하여 `JobLauncher` 로 즉시 실행 및 executionId 반환.
- `GET /api/jobs/{jobName}/executions/{executionId}`: 실행된 Job의 진행 상태를 조회하는 Polling API.

### Backstage Backend (영역 B)
- Proxy 플러그인 맵핑 (`/spring-batch` -> Spring Boot API)
- Casbin 기반 권한 미들웨어 (`casbin_rule` DB 연동, 권한 부족 시 403 Forbidden 응답).
- 인증 식별자 매핑: Backstage 세션의 User Entity Ref (예: `user:default/hoon.yang`)를 Casbin DB의 Subject 포맷으로 변환 및 매핑.

### Backstage Frontend (영역 C)
- `react-jsonschema-form` (rjsf) 기반 UI 렌더링.
- API 호출은 `discoveryApi`와 `fetchApi` 조합으로 인증 토큰 자동 주입.
- 디바운스(Debounce) 적용: 폼 수정 시 API 호출(`POST /validate`)에 디바운스(300ms~500ms)를 적용하여 네트워크 과부하 방지.

## 테스트 및 검증 전략 (신규)
### 테스트 파일 분리 및 CI/CD 실행 단계
- **유닛 테스트**: `src/test/java/.../unit/` 디렉토리에 위치시키며 `*Test.java` 네이밍 컨벤션을 따른다. `SchemaAwareValidator`의 JSON Schema 추출 등 순수 비즈니스 로직을 검증하며, CI 파이프라인의 `build` 및 `test` 태스크 단계에서 실행된다.
- **통합 테스트**: `src/test/java/.../integration/` 디렉토리에 위치시키며 `*IT.java` 네이밍 컨벤션을 따른다. CI 파이프라인의 `integrationTest` 태스크 단계에서 별도로 실행된다.

### Mock 경계 검증 및 프레임워크 배선 테스트
- 통합 테스트 환경(`@SpringBootTest`)에서는 무거운 실제 배치 처리를 방지하기 위해 `JobLauncher` 인터페이스만 `@MockBean`으로 격리한다.
- 단, 해당 Mock 경계를 넘어서는 나머지 모든 프레임워크 의존성(`@RestController`, `@ControllerAdvice`, `JobRegistry`, 빈 등록, JSON 직렬화/역직렬화)은 실제 컨텍스트를 로드하여 최소 1회 이상 MockMvc를 통해 HTTP 요청부터 응답까지의 전체 배선(Wiring)을 통합 검증한다.

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] DDD 및 스펙 준수: Command DTO에 `jakarta.validation` 외 UI 렌더링용 어노테이션 부재
- [ ] UI 렌더링 자동화: 서버 제공 JSON Schema로 동적 폼 완벽히 렌더링
- [ ] 검증 기반 실행: 실시간 폼 검증 통과(서버 유효성 확인) 시에만 미리보기 노출 및 실행 버튼 활성화
- [ ] 통신 보안 및 제어: `fetchApi` 인증 통신, Casbin 403 차단 및 디바운스 처리 확인
- [ ] 테스트 파일 분리 명시: 유닛/통합 테스트 파일이 디렉토리 및 네이밍(`*Test.java`, `*IT.java`)으로 분리되고 CI 실행 단계가 구분됨
- [ ] Mock 경계 검증 항목 포함: `JobLauncher`만 격리하고, MockMvc를 활용해 예외 핸들러 및 빈 등록 등 실제 프레임워크 배선이 통합 테스트 환경에서 검증됨
