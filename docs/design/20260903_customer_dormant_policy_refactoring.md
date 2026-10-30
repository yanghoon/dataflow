# Customer Dormant Policy 리팩토링 설계 스펙

## 목표
DDD(Domain-Driven Design) 스타일의 이벤트 및 커맨드 명명 규칙을 수립하고, CloudEvent 표준을 확장하여 멀티 오픈소스(tool)와 단일 도메인(Customer) 환경을 명확히 식별하도록 기존 코드를 리팩토링한다. `outbox_messages` 테이블을 활용하여, 향후 Kafka 도입 시 Topic 및 Partition Key 매핑을 고려한 아키텍처로 개선한다.

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**: `outbox_messages`를 통한 이벤트 적재 및 기존 `CloudEvent` 포맷 발행 패턴, 기존 설계(`20260901_subscription_dormant_policy.md`, `20260902_outbox_failure_handling.md`).
- **신규로 가는 이유**: 이벤트와 커맨드가 혼재되어 있고, 멀티 툴(Gitea, SonarQube 등) 및 멀티 인스턴스 환경에서 식별자와 순서 보장 규칙이 부재함. Kafka 전환 시나리오까지 대비할 수 있는 통합된 Naming & Routing 규약이 필요함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| **메시지 엔벨로프 패턴** | CloudEvents 규격을 커맨드와 이벤트 모두에 대한 '범용 메시지 엔벨로프(Universal Message Envelope)'로 채택. 의도(Command/Event)는 `type` 네이밍으로만 구분. | 공식 스펙은 'Event'에 한정하지만, 인프라 라우팅/트레이싱의 통일성과 멱등성(`id` 재사용) 확보를 위해 커맨드에도 동일한 봉투(Envelope) 규격을 사용하는 것이 실무적 베스트 프랙티스임. |
| **네이밍 및 클래스 구분** | Command/Event 마커 없이 동사 시제로 구분.<br>커맨드(명령): `<tool>.<verb>.<object>` (예: `gitea.suspend.user`)<br>이벤트(사실): `user.dormancy.detected` (또는 `<object>.<state>.<past_verb>`) | 마커(`...Event`, `...Command`) 제거로 DDD 유비쿼터스 언어를 반영하며, 사람이 네이밍만으로 의도를 직관적으로 구분. |
| **CloudEvent 필드 정의** | **`id`**: `tool \| policyname \| subject \| last_activity`<br>**`source`**: `urn:dataflow:policy:<tool>:dormant`<br>**`subject`**: `<instanceId>\|<domainEntityId>` (멀티 인스턴스) 또는 `<domainEntityId>` (단일 인스턴스)<br>**`type`**: `<tool>.<verb>.<object>` (예: `gitea.suspend.user`, `customer.suspend.account`) | - `id`: 다중 조합으로 멱등성 보장.<br>- `source`: 출처 명확화.<br>- `subject`: 타겟 시스템의 인스턴스 구성(단일/멀티)에 맞춰 유일하게 식별하고 파티셔닝 기준 제공. |
| **Kafka 전환 대비 라우팅** | **Topic**: `tool` 단위 (예: `gitea`, `sonarqube`, `customer`)<br>**Partition Key**: `subject` | - 툴 단위 토픽 분리로 장애 격리 및 관심사 분리. (인스턴스별 토픽 분리 안 함)<br>- 동일 고객에 대한 처리 순서를 완벽히 보장. |
| **배달 보장** | 기존 `outbox_messages` 기반 폴링 및 멱등성 키(`id`) 기반 수신 처리 | At-least-once 배달 구조에서 중복 처리를 수신측 `id` 검증으로 완벽히 통제. |
| **동시성 제어** | Partition Key를 통한 이벤트 순차적 소비 보장 | 동시성 경합 상태에서 특정 사용자에 대한 휴면 처리(커맨드)가 뒤죽박죽 실행되는 현상 차단. |
| **실패/재시도** | 기 확립된 'Outbox Failure & Backoff 설계' 활용 | 별도의 커스텀 실패 처리 없이 인프라 계층의 재시도 정책 상속. |
| **데이터 모델** | `outbox_messages` 테이블을 활용한 Event Sourcing 유사 형태 | 시스템 복구력 향상 및 CloudEvent 표준 호환. |

## 이벤트 및 커맨드 네이밍 뉘앙스와 엄격한 규칙

본 설계는 단순한 이벤트 주도 아키텍처(EDA)가 아닌, 에릭 에반스의 **DDD(Domain-Driven Design)**와 반 버논의 **IDDD(Implementing Domain-Driven Design)** 서적에 등장하는 도메인 중심 설계 사상을 철저히 따릅니다. 따라서 아래의 뉘앙스 차이를 명확히 인지하고 유비쿼터스 언어(Ubiquitous Language)로서 엄격하게 규칙을 준수해야 합니다.

### 1. 발행 주체 및 이벤트 생략 로직 (Orchestration)
*   **Policy 클래스의 역할**: `DormantCustomerPolicy`와 같은 정책 클래스는 단순히 도메인 상태를 평가하는 것을 넘어, **어떤 시스템에 어떤 후속 조치를 취할지 알고 있는 오케스트레이터(Orchestrator)** 역할을 수행합니다.
*   **커맨드 직접 발행의 이유**: "조건 충족 ➡️ `user.dormancy.detected` 이벤트 발생 ➡️ 별도 핸들러가 수신 ➡️ `gitea.suspend.user` 커맨드 발행"으로 이어지는 이론적이고 복잡한 단계를 생략합니다. Policy가 대상 시스템(Gitea, Customer 등)을 명확히 인지하고 있다면, 중간 이벤트를 거치지 않고 **타겟팅된 커맨드를 직접 발행**하여 아키텍처를 단순화하고 실용성을 극대화합니다.

### 2. 이벤트 네이밍의 미묘한 차이 (영문법 기반)
한글로 번역하면 모두 "휴면 계정 발견됨"으로 동일하게 들리지만, 영문 네이밍 시 문법 구조에 따라 DDD 관점의 뉘앙스가 확연히 달라지므로 철저히 분리해서 사용해야 합니다.

*   **`dormant.user.detected` (형용사 + 명사 + 동사 과거형) - (사용 지양)**
    *   **뉘앙스**: '휴면 유저(Dormant User)'라는 특정 파생 엔티티가 새롭게 발견되었다는 느낌을 줍니다. 상태(Dormant)가 유저의 본질적 식별자처럼 취급될 여지가 있어 확장에 불리합니다.
*   **`user.dormancy.detected` (명사 + 명사(상태현상) + 동사 과거형) - (권장 및 고정 규칙)**
    *   **뉘앙스**: 핵심 주체인 '사용자(User)'에게 '휴면이라는 현상(Dormancy)'이 감지되었다는 의미입니다. DDD 관점에서 주체(Aggregate)는 언제나 `User`이며, `Dormancy`는 그 주체에게 발생한 생명주기상 상태 전이임을 훨씬 더 정확하게 드러냅니다. **상태 변경 이벤트를 정의할 때는 반드시 이 방식을 표준으로 사용합니다.**


## 상세 설계: CloudEvent 봉투(Envelope) 및 Kafka 매핑 규칙

본 설계는 중간 이벤트 단계를 생략하고 Policy가 직접 커맨드를 발행하는 오케스트레이션 방식을 허용합니다. (예: `DormantCustomerPolicy` ➡️ `gitea.suspend.user` 직접 발행). 다중 인스턴스(예: Gitea가 여러 개) 환경에서는 Policy가 타겟 인스턴스별로 개별 커맨드를 발행하여 `subject`를 분리합니다.

향후 Kafka 전환 시 "CloudEvents Kafka Protocol Binding"의 **Binary Mode** 디팩토 표준을 준수하며, 각 필드는 인프라 관점에서 다음과 같은 명확한 목적과 매핑 규칙을 갖습니다.

| CE 필드명 | 값 예시 (Gitea / Customer) | 비즈니스 목적 | Kafka 매핑 (Binary Mode) |
|---|---|---|---|
| **`id`** | `gitea\|DormantCustomerPolicy\|gitea-prod-1\|CUST-123\|2026-03-01`<br>`customer\|DormantCustomerPolicy\|CUST-123\|2026-03-01` | **Idempotency Key (멱등성 보장)**: 수신측에서 중복 수신 시 무시하기 위한 고유키. | `ce_id` Header |
| **`type`** | `gitea.suspend.user`<br>`customer.suspend.account` | **Routing & Filtering**: 의도(Command/Event) 표현. 첫 번째 세그먼트를 파싱하여 타겟 결정. | `ce_type` Header.<br>※ 어플리케이션이 이 값을 파싱하여 전송할 **Kafka Topic**을 동적으로 결정함. |
| **`source`** | `urn:dataflow:policy:gitea:dormant`<br>`urn:dataflow:policy:customer:dormant` | **Origin Tracking (출처 식별)**: 장애 발생 및 CS 인입 시 어느 도메인/배치에서 발생시켰는지 즉각 식별. | `ce_source` Header |
| **`subject`** | `gitea-prod-1\|CUST-123` (멀티 인스턴스)<br>`CUST-123` (단일 도메인) | **Target & Partitioning**: 타겟 구성에 따른 식별자. 단일 인스턴스(예: `customer`)는 도메인 ID만 사용. | `ce_subject` Header.<br>※ 이 값을 추출하여 **Kafka Record Key**에 바인딩하여 파티션 순서 보장. |
| **`data`** | `{"instanceId":"gitea-prod-1", "thresholdDays":180, ...}`<br>`{"customerId":"CUST-123", "subscriptionDate":"2020-01-01"}` | **Domain Payload**: 라우팅 정보를 배제한 순수 비즈니스 데이터. 단, 워커의 편의를 위해 멀티 인스턴스는 `instanceId`를 본문에도 포함. | **Kafka Record Value** (JSON 등 바디) |

※ 주의: CloudEvents 스펙은 Protocol-Agnostic 하므로 `ce_topic` 같은 커스텀 필드를 만들어 토픽 이름을 강제 명시하는 것은 안티 패턴입니다. Topic은 반드시 `type` (또는 `source`) 값을 기반으로 발행자(Publisher) 애플리케이션 단에서 결정해야 합니다.

## 이벤트 소비 (Poller & Handler) 구조 설계

이벤트 적재(`outbox_event`) 후 소비 과정은 다음과 같이 설계한다.

### 1. 통합 Poller(JDBC Event Poller) 운용
- **타입에 무관한 단일 Poller**: 기존에 `type`별로(예: `toolA.%`, `toolB.%`) 분리되어 있던 Poller를 제거하고, `outbox_event`에서 `type`과 무관하게 `READY` 상태인 모든 이벤트를 조회하는 단일(Unified) `JdbcEventMessagePoller` 1개만 운용한다.
- **장점**: 새로운 도메인이나 툴이 추가되더라도 Poller(인프라) 설정을 변경할 필요가 없다.

### 2. Spring ApplicationEventPublisher 기반 분배
- 단일 Poller는 읽어온 CloudEvent를 Spring의 `ApplicationEventPublisher`를 통해 브로드캐스팅한다.
- `@EventListener(condition = "#a0.type.startsWith('customer.')")`와 같이 조건부 리스너를 통해 각 핸들러(Handler)가 자신이 관심 있는 이벤트만 선택적으로 처리한다.
- 불필요했던 기존 `ToolA`, `ToolB` 핸들러는 삭제하고, `CustomerEventHandler` 단 1개만 유지 및 구성한다.

### 3. 미매칭 이벤트(No matching listener) 처리 주의사항
- Spring Event 메커니즘 특성상 발행된 이벤트에 매칭되는 `@EventListener`가 없더라도 에러가 발생하지 않는다.
- 이 경우 Poller는 예외를 받지 못하므로 정상 처리된 것으로 간주하고 DB 상태를 `DONE`으로 변경하게 되며, 결과적으로 핸들러가 없는 **이벤트가 유실(Silent Drop)**되는 현상이 발생한다.
- **설계적 보완/주의**: 이를 인지하고 개발 시 새로운 `type` 발행에 맞는 핸들러가 반드시 존재하는지 확인해야 하며, 추후 인프라 레벨에서 미매칭 이벤트를 로깅(Catch-all)하거나 데드레터(DLQ) 처리하는 방안을 고려할 수 있다.

## 구현 범위 및 리팩토링 체크리스트

위 설계에 따라 실제 코드를 수정해야 할 범위는 다음과 같다.

### 1. 클래스 및 파일명 변경 (Naming)
- **Java**: `SubscriptionDormantPolicy.java` ➡️ `DormantCustomerPolicy.java`
- **Tests**: `SubscriptionDormantPolicyTest`, `SubscriptionDormantPolicyYamlIntegrationTest` ➡️ `DormantCustomerPolicy...` 로 변경
- **SQL**: `src/main/.../sql/` 및 `src/test/.../sql/` 하위의 `subscription_dormant_policy.sql` ➡️ `dormant_customer_policy.sql` 로 변경

### 2. Policy 비즈니스 로직 수정 (CloudEvent 매핑)
기존 `AbstractPolicy`가 외부(YAML) 설정에 의존하던 결합을 끊고, Policy 내부에서 명시적으로 제어한다.
- **`getType()` 반환값**: `"subscription-dormant-policy"` ➡️ `"customer-dormant-policy"`
- **`EventId.generate()` 식별자 로직**: `targetDomain`("customer")을 조합하여 `customer|DormantCustomerPolicy|{customerId}|{subscriptionDate}` 포맷 생성.
- **`toEvent()` 오버라이드**: YAML의 `eventSource`, `eventType` 속성을 배제하고, `builder`에 직접 `source`(`urn:dataflow:policy:customer:dormant`), `type`(`customer.suspend.account`), `subject`(`customerId`)를 명시적으로 세팅.

### 3. YAML 설정 점검 및 수정
- `application-workflow.yaml` 및 `application-dormant-policy.yml`에서 Job 이름을 `customer-dormant-policy-job`으로 변경.
- CloudEvent 매핑에 사용되던 불필요한 속성(`eventSource`, `eventType`) 삭제 및 `sqlPath` 업데이트.

### 4. Consumer (Poller & Handler) 리팩토링
- **`EventPollerConfig.java`**: 기존 `toolAPoller()`, `toolBPoller()`를 제거하고, `type` 조건 없이 모든 READY 상태 이벤트를 읽어오는 단일 `unifiedPoller()` 생성 및 스케줄 등록.
- **Handler 클래스**: 쓸모없는 `ToolAEventHandler`, `ToolBEventHandler` 삭제. 대신 `customer.suspend.account` 커맨드를 수신할 `CustomerEventHandler` 뼈대(Scaffolding) 신규 생성.

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트: CloudEvent 객체 생성 시 요구사항에 맞춘 `id`, `source`, `subject`, `type` 조합 정상 생성 확인
- [ ] 유닛테스트: 네이밍 컨벤션 검증(커맨드는 현재/명령형, 이벤트는 과거/완료형 검증)
- [ ] 커버리지 기준: 85%

## 미결 사항
- 없음
