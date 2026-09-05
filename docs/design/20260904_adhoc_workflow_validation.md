# Ad-hoc 워크플로우잡 파라미터 검증 설계 스펙

## 목표
- Ad-hoc 실행을 위해 워크플로우잡을 조회한 후, 스케줄을 등록(db-scheduler)하기 전에 기본 파라미터와 오버라이드된 파라미터 조합이 정상적인지 검증(Validate)하는 로직을 추가한다.
- 웹 계층(RestController)이 파라미터 스펙을 직접 알지 못하도록, 검증 책임을 `WorkflowLauncher`와 `Workflow` 도메인으로 위임하여 API 캡슐화를 보호한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: `docs/design/20260903_adhoc_workflow_execution.md` 설계 문서 내의 "향후 구현 항목 1. 도메인 위임 사전 검증"
- 신규로 가는 이유 (기존 걸로 안 되는 이유): 현재 `WorkflowJobViewController`는 파라미터를 병합하고 즉시 db-scheduler에 스케줄링함. 잘못된 파라미터 조합이 인입되더라도 비동기 실행 시점에야 실패하므로 어드민 사용자에게 즉각적인 피드백(400 Bad Request)을 줄 수 없음.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 검증 주체 / 캡슐화 | `WorkflowLauncher` 및 `Workflow` 인터페이스에 `validate` 위임 | 컨트롤러가 파라미터 도메인 규칙을 알게 되면 캡슐화가 깨짐. 컨트롤러는 `WorkflowLauncher.validate()`를 호출하고, Launcher는 파라미터를 병합한 뒤 `Workflow.validate()`를 호출하는 구조 채택. |
| 배달 보장 | at-most-once (즉시 검증) | 스케줄 등록 전에 동기로 수행되는 순수 검증 로직이므로 부수효과(side-effect) 없음. |
| 동시성 제어 | 락킹 불필요 | 단순 조회 및 검증 로직이므로 동시성 충돌 없음. 기존 Ad-hoc 스케줄링의 고유 ID(UUID) 격리 방식은 그대로 유지. |
| 실패/재시도 | `BindException` 핸들링 및 HTTP 400 | 파라미터 타입 바인딩 실패 시 발생하는 스프링 부트의 기본 `BindException`(RuntimeException인 `org.springframework.boot.context.properties.bind.BindException`)을 웹 계층(RestController 또는 Advice)에서 가로채어 실패한 필드와 원인을 추출한 후 HTTP 400 에러로 반환한다. |
| 데이터 모델 | `Workflow` 인터페이스에 `validate` 추상 메서드 추가 | `void validate(WorkflowJob job, WorkflowParams overrideParams);`로 선언하여 모든 Workflow 구현체가 명시적으로 검증 로직(빈 구현 포함)을 작성하도록 강제한다. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] `Workflow` 인터페이스에 `validate` 추상 메서드 선언 및 모든 기존 `Workflow` 구현체에 오버라이드 로직 구현(빈 로직 포함)
- [ ] `WorkflowLauncher` 인터페이스에 `validate(String jobName, Map<String, String> overrideParams)` 명세 추가 및 구현
- [ ] `WorkflowJobViewController.runAdhoc()`에서 스케줄링(`schedulerClient.schedule`) 전 `WorkflowLauncher.validate()` 호출 반영
- [ ] 유닛테스트: 잘못된 파라미터 조합 전달 시 `WorkflowLauncher.validate()`가 `BindException`을 던지고, 컨트롤러가 이를 잡아 필드별 에러 정보와 함께 400 Bad Request 에러로 응답하는지 검증
- [ ] 통합테스트: Ad-hoc API 호출 시 올바른 파라미터일 때만 정상 스케줄링되는지 검증
- [ ] 커버리지 기준: 관련 로직 80% 이상 유지

## 구현 고려 사항
- 기본적으로 스프링 부트의 바인더(`Binder`)를 통한 타입 변환 에러(RuntimeException인 `org.springframework.boot.context.properties.bind.BindException`)를 웹 계층에서 가로채어 처리한다. 만약 단순 타입 검증을 넘어선 복잡한 비즈니스 도메인 검증 로직(예: 특정 조건일 때만 필수인 필드 등)이 필요한 경우에는 자바 표준인 `IllegalArgumentException`을 던져 400 에러로 처리하는 방안을 필요 시 별도 구현할 수 있다.
