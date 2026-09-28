# Spring Batch × Backstage 통합 코드 구조 리팩토링 설계 스펙

## 목표
기존 `v2` 패키지에 구현되었던 Backstage 연동 관련(Spring Batch 통합) 코드들을 `workflow` 패키지 하위로 이동하여 계층 구조를 정돈한다. 이동 완료 후 파편화된 `v2` 패키지는 하위 코드와 함께 완전히 삭제한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: 이전 설계 스펙 (`docs/design/20260927_spring_batch_backstage_integration_config.md`)
- 신규로 가는 이유 (기존 걸로 안 되는 이유): `v2` 패키지 하위에 흩어져 있던 Batch/Backstage 관련 REST API, 유효성 검증, 서비스 로직들을 메인 워크플로우 아키텍처인 `io.slim.workflow` 하위 계층에 맞게 일원화하고, 불필요한 레거시 코드를 정리하기 위함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 / 동시성 / 실패 | 이전 스펙과 동일하게 유지 | 본 설계는 구조 이동(Refactoring)에 한정되므로 기존 멱등성 및 예외 정책 계승. |
| 이동 대상 (REST) | `AdminJobController`, `JobController`, `ValidationExceptionHandler`, `ConfigSchemaGenerator`, `SchemaAwareValidator` &rarr; `workflow.app.adapter.rest.batch` | 외부 진입 API 및 API에 종속적인 검증/스키마 유틸리티를 `adapter.rest.batch` 패키지로 응집. (단, `ConfigController` 및 `Setting~` 관련 클래스는 제외) |
| 이동 대상 (Service) | `JobTriggerService` &rarr; `workflow.app.service` | 배치 실행 트리거 로직을 `app.service`로 배치. (단, `JobDef`는 이동 대상에서 제외) |
| 패키지/계층 제약 | `workflow.domain` 영역에는 이번 리팩토링으로 클래스를 추가하지 않음 | 사용자의 명시적 아키텍처 컨벤션 (어댑터 및 애플리케이션 서비스 위주로 재편). |
| 불필요 레거시 정리 | 이동 작업 및 테스트 이동이 완료된 후, 기존 `io.slim.ingestion.batch.v2` 하위 디렉토리는 통째로 삭제 | 이동 제외된 코드들을 포함해 불필요해진 레거시 잔존 방지. |

## 파라미터 시간 결합
이동 전 기존 로직(예: `JobTriggerService`, `JobController`에서 생성하는 현재 시간 기반 파라미터)을 그대로 유지한다.

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] `v2` 패키지(및 하위 파일 전체) 삭제
- [ ] 유닛테스트 및 통합테스트 이동 / 성공 여부 검증:
  - 이동 대상과 연관된 기존 테스트 파일(`AdminJobControllerTest`, `SchemaAwareValidatorTest`, `AdminJobControllerIT` 등)을 새 패키지 경로로 함께 이동
  - 모든 테스트 PASS
- [ ] 커버리지 기준: 기존 커버리지 유지 (클래스 이동으로 인한 하락 없음)

## 미결 사항
- 없음
