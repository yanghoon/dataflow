# Subscription Dormant Policy 설계 스펙

## 목표
- `customers` 테이블 데이터를 기반으로, 특정 가입일(Subscription Date) 기준 조건을 만족하는 사용자를 조회하여 `event queue table (outbox_event)`에 CloudEvent 포맷으로 휴면 이벤트를 추가하는 Policy 클래스 구현.
- `WorkflowJob`의 `props`로부터 기준 날짜 값(`thresholdDays`, 0 < 값 < 180)을 주입받아, 실행 시점(`CURRENT_DATE`) 기준으로 가입일이 해당 일수 이상 경과한 사용자를 추출한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: `io.slim.workflow.app.adapter.workflow.event.AbstractPolicyWorkflow` 및 `DormantCustomerPolicyWorkflow` (A안 채택)
- 신규로 가는 이유 (기존 걸로 안 되는 이유): 기존 `Workflow` 인프라와 동작 메커니즘을 동일하게 재사용하되, "정책(Policy)"이라는 도메인 의미를 부여하여 워크플로우와 클래스 명명 규칙으로 구분하기 위함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 대상 테이블 및 조회 기준 | `customers` 테이블에서 최신 `snapshot_date`를 가진 데이터만 쿼리 | 스냅샷에 따른 중복 데이터를 피하고 가장 최신 상태의 가입자만 대상에 포함하기 위함. |
| 필요 값 및 시간 기준 | `thresholdDays` 파라미터 활용, 실행 시점(`CURRENT_DATE`) 기준 비교 | 워크플로우 `props`에서 설정값을 유연하게 주입. 배치 실행 특성상 실행 날짜 기준(`CURRENT_DATE - subscription_date`)으로 상대적인 계산 수행. (사용자 요구 반영) |
| 배달 보장 | At-least-once, DB `ON CONFLICT DO NOTHING` 활용 | 멱등성 보장. 고유 키 조합(`CustomerId + "\|" + PolicyName + "\|" + SubscriptionDate`)을 통해 상태 변경 지연 시 중복 발행을 완벽히 방어. |
| 동시성 제어 | 스케일 아웃 환경에서의 배타적 이벤트 소비 | 여러 대의 서버(Pod)에서 동시 실행되더라도 1대만 작업을 수행하도록 제어. 프로젝트 내 `db-scheduler`의 Task Lock(배타적 실행) 기능을 적극 활용. |
| 실패/재시도 | 수동 실행: 재시도 / 스케줄 실행: 다음 주기에 위임 | 비즈니스 요구사항 수용. 일시적 장애(DB 타임아웃 등) 시 스케줄러의 다음 실행 주기에 의존하여 자동 복구. |
| 데이터 모델 | `CloudEvent` 포맷 (`outbox_event` 테이블 적재) | 기존 이벤트 브로커 및 Outbox 릴레이어나 컨슈머와의 완벽한 호환성 유지. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트: 고유 Key 생성 로직 검증 (Edge 시나리오 정상 처리)
- [ ] 통합테스트: Testcontainers (PostgreSQL)를 띄워 실제 쿼리 실행, `outbox_event` INSERT 및 `ON CONFLICT` 중복 방어 작동 여부 검증
- [ ] 커버리지 기준: 핵심 비즈니스 로직(Key 생성, ResultSet 매핑 등) 테스트 커버리지 달성

## 미결 사항
- 없음 (모든 주요 요구사항 확정 완료)
