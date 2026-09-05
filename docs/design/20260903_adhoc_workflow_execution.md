# Ad-hoc 워크플로우잡 실행 설계 스펙

## 목표
- 어드민 시나리오 기준으로 워크플로우잡 에드훅(수동) 실행에 필요한 구현 내용을 점검한다.
- `RemotePostgresFdwWorkflow`에서 사용된 `workflowjob props binder` 패턴을 Ad-hoc 실행 시 전달되는 동적 파라미터(overrideParams)에도 동일하게 적용하여 타입 안정성을 확보한다.
- 에드훅 스케줄이 db-scheduler UI에서 조회되고, 자동 실행되지 않으며, 사용자가 수동으로 실행될 수 있도록 구성하는 것이 아키텍처적으로 적절한지(오버 엔지니어링 여부) 검토한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: `RemotePostgresFdwWorkflow.java`의 `PostgresFdwContext.of(job)` 
  - 현재 이 패턴은 정적 설정인 `job.props()`만을 Binder로 변환하고 있어 런타임 `params`가 누락되는 구조적 한계가 존재함.
- 신규로 가는 이유 (기존 걸로 안 되는 이유): Ad-hoc 실행 시 어드민이 넘겨주는 동적 파라미터(`overrideParams`)가 개별 Workflow 로직 실행 시 `props binder`를 통해 하나의 문맥 객체(Context)로 융합되어야 함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 파라미터 병합 방식 | `job.props()`와 `overrideParams` 병합 후 Binder 적용 | 정적 설정과 런타임 오버라이드 값이 Workflow 내부에서 동일한 Context 객체로 투명하게 바인딩되도록 함. 런타임 파라미터가 우선순위를 가짐. (`WorkflowPropsBinder.bind(job, params, T.class)` 공통 유틸 생성) |
| 파라미터 시간 결합 | 어드민 입력값(`overrideParams`) 우선 (고정 시점) | 서버의 실행 시점(상대 시간)과 무관하게, 어드민 사용자가 명시한 입력값을 우선하여 시간 의존성 문제를 방지함. |
| 공통 바인더의 효용 | Map 병합 및 타입 변환/검증의 중앙화 | 개별 Context 클래스(Record)를 만드는 것은 동일하나, 개별 Workflow 개발자가 `Map.putAll()` 로직을 중복 작성할 필요가 없어짐. String Map을 Enum, Date, List 등 강타입으로 변환하는 처리가 일원화되어 파라미터 검증이 투명해짐. |
| UI 기반 수동 실행 대기 상태 | 도입하지 않음 (API 기반 즉시 실행 유지) | db-scheduler에 영구적 대기 상태(예: 2099년 실행)의 Task를 심어 UI 'Run' 버튼을 사용하는 것은 **명백한 오버엔지니어링이자 안티패턴**임. db-scheduler는 타이머 기반 스케줄링 도구이므로 Ad-hoc 실행은 자체 어드민 프론트엔드에서 API(`runAdhoc`)를 호출해 `Instant.now()`로 즉시 큐잉하는 현재 구조가 적절함. |
| 배달 보장 | at-least-once (기존 스케줄러 정책 승계) | 어드민 요청 시 즉각 `scheduled_tasks`에 기록되어 실행을 보장함. 실패 시 Workflow 설정에 따른 재시도 정책이 적용됨. |
| 동시성 제어 | UUID 인스턴스 격리 | Ad-hoc Task는 `adhoc-{jobName}-{UUID}` 형태의 고유 ID로 생성되어 기존 스케줄 실행(그룹 기반)과 물리적으로 분리 실행되며, 타 Ad-hoc과도 충돌하지 않음. |
| 실패/재시도 | 어드민 반환 정책 | Ad-hoc 에러는 3회 재시도(스케줄러 기본 정책)를 거치며, 최종 실패 시 에러 로그와 함께 Execution 이력으로 남음 (알람/DLQ 없음). 수동 재요청으로 대응. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트: `WorkflowPropsBinder`가 `job.props`와 `params`를 정상 병합하고, 동적 `params`가 덮어쓰는지 검증
- [ ] 통합테스트: `runAdhoc` API 호출 시 Binder를 거쳐 동적 값이 반영된 형태로 Workflow가 실행되는지 확인 (mock Workflow 사용)
- [ ] 커버리지 기준: 80%

## 미결 사항 (UX 관점의 API 보완점)
현재 `WorkflowJobViewController`의 REST API는 관리자 UX 관점에서 다음 항목들이 부족하여 개선이 필요합니다:
1. **Ad-hoc 실행 후 추적 불가**: `POST /{jobName}/run` 엔드포인트가 `void`를 반환합니다. 관리자가 버튼을 누른 후 해당 실행건의 성공/실패 여부를 추적할 수 있도록 `taskInstanceId`를 반환해야 합니다.
2. **입력 폼 렌더링 정보 부재**: `GET /admin/workflow-jobs` 목록 응답(`WorkflowJobView`)에 `allowedOverrides`(오버라이드 허용 파라미터 목록)와 `props`(기본 설정값)가 누락되어 있습니다. 이 정보가 없으면 어드민 UI에서 사용자에게 "어떤 값을 수정할 수 있는지" 동적 폼(Form)을 그려줄 수 없어 불편합니다.

## 향후 구현 항목 (도메인 위임 사전 검증 및 동시성 제어)
안정적인 운영 및 UX 향상을 위해 논의되었으나, 이번 구현 범위의 복잡도를 낮추기 위해 **다음 페이즈로 연기된 항목들**입니다.

1. **도메인 위임 사전 검증 및 명시적 실패 기록 (Fail-fast & Audit)**
   - **배경**: 웹 계층(API)이 파라미터 타입 메타데이터를 직접 알게 되면 의존성 캡슐화가 깨집니다. 반면, 검증 없이 스케줄러로 넘기면 런타임에 실패하여 즉각적인 피드백(400 Bad Request)이 불가합니다.
   - **향후 설계안**: `Workflow` 인터페이스에 `validate(job, params)`를 추가하여 검증 책임을 도메인에 위임합니다. API는 스케줄링 직전에 `WorkflowLauncher.validate()`를 호출하고, 실패 시 런처 내부에서 `WorkflowExecution`에 'VALIDATION_FAILED'로 즉시 기록한 뒤 에러를 반환합니다. 이를 통해 **API 캡슐화 보호 + 정확한 비즈니스 검증 + 감사 로그(Audit) 100% 기록**을 모두 달성할 수 있습니다.
2. **중복 실행 방지 (동시성 제어)**
   - **배경**: 현재는 관리자가 '실행'을 여러 번 누르거나, 기존 스케줄(Cron)이 도는 와중에 Ad-hoc을 실행하면 동일한 작업이 중복 실행될 수 있습니다.
   - **향후 설계안**: REST API 호출 시점에 해당 `jobName`으로 이미 '실행 중(Running)'인 작업이 있는지 검사하고, 있을 경우 HTTP 409 Conflict 등으로 튕겨내는 방어 로직을 추가해야 합니다.
3. **수동 트리거 주체(Admin) 감사 로그 기록**
   - **배경**: 수동 실행은 누가 강제로 실행했는지 이력이 중요하나 현재 누락되어 있습니다.
   - **향후 설계안**: API 파라미터나 인증 헤더에서 `operatorId`(관리자 식별자)를 추출하여 `WorkflowExecution` 또는 DB 스케줄러 `taskData`에 감사 로그로 적재해야 합니다.
