# ADR 0001: 이벤트 추출 워크플로우 멱등성 및 중복 방지 설계

## Status
**Accepted**

## Context
고객(`customers`) 테이블에서 특정 조건(예: 휴면 전환)을 만족하는 대상을 주기적으로 추출하여 `outbox_event` 테이블에 적재하는 워크플로우가 존재합니다. 
이 잡(Job)이 반복 실행될 때, 이미 처리된 대상이 다시 조회되어 중복 이벤트가 무한정 쌓이는 것을 방지해야 합니다. 
수신 측의 멱등성과는 별개로 이벤트 발행 스토어 자체의 데이터(디스크) 증가를 물리적으로 제어할 필요가 있습니다.

## Decision
1. **원본 데이터 기반의 결정적(Deterministic) ID 사용**:
   - 매번 새로운 랜덤 식별자(UUIDv4, v7 등)를 발급하지 않고, 유저가 재접속하기 전까지 변하지 않는 **`last_login_date`**를 이용해 Natural Key를 구성합니다. 
     *(예: `customerId + "|dormant|" + lastLoginDate`)*
   - 이 Natural Key를 해싱한 **UUIDv3**를 이벤트의 `id`로 사용합니다.
2. **복합 PK를 통한 물리적 중복 방지**:
   - CloudEvent 스펙에 맞춘 `outbox_event` 테이블의 **`PRIMARY KEY (source, id)`**를 그대로 활용하여 중복 삽입을 원천 차단합니다.
3. **충돌 시 안전한 무시 (UPSERT - DO NOTHING)**:
   - 일괄 적재(Batch Insert) 시 중복된 `id`가 발견되면 예외가 발생해 배치 전체가 실패하는 것을 막기 위해 PostgreSQL의 `ON CONFLICT (source, id) DO NOTHING` 구문을 적용합니다.

## Consequences
- **Positive**: 
  - 원본 상태에 결속된 완벽한 발행 멱등성을 확보합니다. 동일 조건에서 워크플로우가 100번 재실행되어도 큐에는 이벤트가 1건만 적재됩니다.
  - 고객이 다시 로그인하여 상태(`last_login_date`)가 갱신되면 자연스럽게 새로운 휴면 이벤트가 정상 발급됩니다.
- **Negative**:
  - 코드 상에서 Natural Key를 조합하고 UUIDv3로 명시적 변환하는 해싱 로직이 동반되어야 합니다.
