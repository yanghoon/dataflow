# 이벤트 타입 안전성 강화 설계 스펙

## 목표
- `ApplicationEventPublisher` 사용 시 이벤트 리스너가 누락되어도 예외 발생 없이 조용히 성공(status='DONE') 처리되는 이슈를 근본적으로 차단한다.
- CloudEvent 타입(`type`)을 문자열(String)에서 애플리케이션 경계의 `Enum`으로 전환하여 컴파일 타임 및 기동 시점 안정성을 확보한다.

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**: 기존 `ApplicationEventPublisher`를 통한 이벤트 발행 및 `@EventListener` 수신 구조.
- **신규(Dispatcher)로 가는 이유 및 프레임워크 대안 검토 (YAGNI 판단)**: 
  - 스프링 이벤트 시스템 고유의 "리스너 부재 시 조용한 성공" 문제를 해결하기 위함. 리플렉션 검증은 SpEL 조건식 등 한계가 있음.
  - **Spring Integration**: 개념(MessageChannel, Router, ServiceActivator 등)이 방대하고 디버깅이 간접적이며 단순 DB 폴링 대비 범용 프레임워크 오버헤드와 팀 학습 비용이 과도하여 기각 (복잡도: 최대).
  - **@KafkaListener**: 단일 응집된 어노테이션과 명확한 디버깅을 제공하지만, 실제 분산 메시징 인프라가 도입되는 Phase 2 시점에나 필요하므로 현재는 기각 (복잡도: 중간).
  - **직접 구현(Enum + Dispatcher)**: 순수 Java 문법(Map, 인터페이스)만을 사용하여 학습 곡선이 없고 호출 스택이 직관적임. 현재 규모(DB 1개, 핸들러 소수)에 가장 적합한 최소 복잡도 솔루션으로 채택 (복잡도: 최소).

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 및 실패 처리 | 미등록/미지원 `type`은 `Dispatcher`에서 즉시 예외(`UnknownEventTypeException`) 발생 및 영구 실패(Permanent Failure) 처리 | 핸들러 미등록은 재시도해도 해결되지 않는 배포 문제이므로, 재시도 큐(READY)에 남기지 않고 즉시 `FAILED`로 마킹하여 무한 재시도(좀비 데이터)를 방지함. |
| 동시성 제어 | `CloudEventDispatcher` 내부의 `handlers` Map은 생성자 기동 시 1회 세팅(Read-only) | Poller의 다중 Virtual Thread 병렬 처리에 동시성 병목이나 경합을 주지 않음. |
| 데이터 모델 | 기존 `CloudEvent` 스펙 유지. 애플리케이션 수신 경계에서만 `String -> Enum` 단일 변환 | 범용 이벤트 브로커(Kafka 등) 호환성 유지 및 내부 타입 세이프티 동시 충족. |
| 자가검증 조건(Fail-Fast) | `EventHandlerCoverageValidator` 빈을 통한 `@PostConstruct` 기동 시점 검증 | `EventType` Enum에 정의된 모든 타입에 대해 실제 빈이 등록되어 있는지 애플리케이션 기동 시점에 100% 검증. |
| 파라미터 시간 결합 | 파라미터 결합 없음. 모든 핸들러 라우팅 맵은 시스템 기동 시점에 절대 고정됨. | |

## 핵심 아키텍처 문답 (Q&A)

**Q1. "핸들러 없음" 오류 발생 시 Poller가 이를 조용히 무시(Ignore)해야 하는가?**
> **아니요, `FAILED`로 명확히 마킹해야 합니다.**
> 핸들러 미등록(`UnknownEventTypeException`)은 재시도해도 절대 스스로 복구되지 않는 **영구 실패(Permanent Failure)**입니다(코드가 배포되어야만 해결됨). 무시하고 `DONE` 처리하면 애초에 제기된 문제(조용히 성공 처리)로 회귀하는 것이고, 아무 조치 없이 둔다면 아래 Q3의 무한 재조회 루프에 빠지게 됩니다. 기존 설계된 `PermanentFailureException` 흐름에 태워 즉시 `FAILED` 상태로 전이시켜야 합니다.

**Q2. CloudEvent 포맷을 쓰는데 "이벤트는 안 받아도 되고, 커맨드는 받아야 한다"는 구분이 있는가?**
> **없습니다. 아웃박스 큐의 모든 레코드는 필수 처리 대상입니다.**
> 기존의 "이벤트 vs 커맨드" 논의는 데이터의 의미(명명론)에 대한 것이었지 처리 의무에 대한 것이 아닙니다. 큐에 적재된 데이터(웹훅 발송, 계정 정지 등)는 그 포맷에 상관없이 **반드시 처리되어야 할 액션**이므로, "핸들러가 없어도 무방한 타입"은 존재하지 않습니다. 존재한다면 애초에 큐에 적재되지 말았어야 합니다.

**Q3. `FAILED` 마킹을 하지 않고 놔두면 발생하는 문제는 무엇인가?**
> **좀비 데이터(Zombie Row)로 인한 무한 폴링 병목이 발생합니다.**
> Poller는 항상 `WHERE status = 'READY'`(또는 `PENDING`) 조건으로 조회합니다. 실패 상황에서 명시적으로 `FAILED`로 마킹하여 상태를 전이시키지 않으면, 매 폴링 주기마다(1초) 계속 SELECT 되고 계속 핸들러 없음 예외가 발생하는 악순환이 영원히 반복됩니다. 명시적 `FAILED` 마킹만이 이 데이터를 다음 폴링 대상에서 영구 제외시킬 수 있습니다.

## 완료 조건 (자가검증)
- [ ] **컴파일/빌드 통과**: 기존 `@EventListener` 제거 및 `CloudEventHandler` 인터페이스 구현체로 전환.
- [ ] **유닛테스트**:
  - `EventTypeTest`: `from(String)` 변환 검증 및 매칭 실패 시 `UnknownEventTypeException` 발생 검증.
  - `CloudEventDispatcherTest`: 등록된 핸들러 정상 호출 및 미등록 호출 시 `IllegalStateException` 예외 발생 확인.
- [ ] **통합테스트 (Mock 경계 검증)**:
  - `EventHandlerCoverageValidatorIT`: Spring Boot Context를 띄워 모든 `EventType`이 지원되는지 검증 (ContextLoads 자체로 증명).
  - 기존 `EventListenerIntegrationTest`는 죽은 리스너 경로가 남지 않도록 **삭제**하고, `CloudEventDispatcherIntegrationTest`를 신규 작성하여 새 `Dispatcher` 빈이 정상 작동하는지 검증.
  - `OutboxPollerDatabaseIntegrationTest`를 수정하여 새로운 상태 모델(7가지)에 맞춘 DB 상태 갱신을 확인.
- [ ] **커버리지 기준**: 신규 작성된 `Dispatcher` 및 `Validator` 로직 라인 커버리지 90% 이상.

## 이벤트 큐 상태 모델 정의 및 고도화

기존 `READY`, `DONE`, `FAILED`의 단순 상태 모델을 확장하여 명확한 생명주기를 가진 7가지 상태로 정의하고, DB 컬럼에 영속화합니다.

### 1. 상태 정의 (`EventStatus` Enum)
| 상태 | 의미 | 진입 조건 | 종결(Terminal) |
|---|---|---|---|
| **PENDING** | 처리 대기 중 (초기 상태) | 최초 적재 시 기본값 (기존 READY 대체) | ✗ |
| **PROCESSING** | 워커가 처리 중 | `FOR UPDATE SKIP LOCKED` 선점 직후 | ✗ |
| **SENT** | 외부 API 호출 (응답 미확인) | 타임아웃/응답유실 시 (필요 시 도입) | ✗ (별도 확인 필요) |
| **CONFIRMED** | 처리 성공 확인 완료 | 성공 응답 반환 시 (기존 DONE 대체) | ✅ |
| **RETRY_PENDING** | 일시적 실패, 재시도 대기 | retryable 예외 발생 + 최대 재시도 미만. (대기 시간 도래 시 별도 스케줄러/쿼리에 의해 `PENDING`으로 승격됨) | ✗ |
| **FAILED** | 영구 실패 (재처리 안 함) | 핸들러 미등록 등 permanent 예외 발생 | ✅ |
| **CANCELLED** | 처리 전 수동 취소 | 운영자의 명시적 취소 요청 | ✅ |

### 2. 단일 통합 예외 (`DispatchException`) 패턴
예외 타입을 파편화하는 대신, 발생한 예외에 **목표 상태(Target Status)를 실어서 던지는 구조**를 채택합니다.
- 핸들러 미등록(영구 실패): `throw new DispatchException(EventStatus.FAILED, ...)`
- 일시적 네트워크 오류(재시도): `throw new DispatchException(EventStatus.RETRY_PENDING, ...)`
- **미분류 예외(Default)**: 명시되지 않은 일반 `Exception`은 기본적으로 `RETRY_PENDING`으로 간주하여 일시적 오류로 재시도 처리.
- Poller는 예외를 캐치하여 곧바로 해당 상태(targetStatus)로 DB 레코드를 갱신하므로, 무한 폴링 병목(좀비 로우)을 완벽히 차단합니다.

### 3. 스키마 제약 및 마이그레이션 (`outbox_event`)
- PostgreSQL의 Native Enum 대신 유연성이 높은 `VARCHAR(20) + CHECK` 제약 조건을 적용합니다.
  - (향후 Native Enum 변경 시 `ALTER TYPE`에 따른 트랜잭션/DB 락 이슈를 회피하기 위한 운영적 선택)
- 기존 CloudEvent의 `extensions` JSONB 필드 내에 관리되던 `retry_count`와 `next_retry_at`을 별도 컬럼으로 분리하거나, 기존처럼 유지하되 명시적 상태 전이(MAX 임계값 비교)에 적극 활용하도록 마이그레이션합니다. (MAX 임계값은 환경변수/설정파일의 `app.outbox.default.retry.max-attempts` 활용)

## 미결 사항
- **SENT 상태 도입 여부**: 외부 API의 idempotency(멱등성) 지원 여부 및 실제 타임아웃 빈도를 확인한 후 최종 판단 필요 (현재 시점에서는 제외).
