# Spring Batch DSL 고도화 및 구조 검증 설계 스펙

## 목표
- 기존 구성된 Spring Batch DSL의 문법적 모호성과 타입 추론 한계를 극복하고, OCP(개방-폐쇄 원칙)를 준수하는 유연한 확장 구조를 확립한다.
- 동기(Sync) 및 비동기(Async) 처리 방식의 혼용을 원천 차단하고, `Writer` 설정의 오버로딩 모호성을 정적 팩토리 메서드로 해결한다.
- `CursorReaderSpec` 외에도 `PagingReaderSpec` 등 Reader 전략을 일반화하여 일관된 신택스 슈거(`.and()` 등)를 제공한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: `20260914_spring_batch_dsl_wrapper.md` 및 `20260920_async_api_sync_job.md`의 구조.
- 신규로 가는 이유 (기존 걸로 안 되는 이유):
  - Java의 제네릭 SAM 타입 추론 한계로 인해 `step` 내부 람다에서 입출력 타입이 소실되는 문제.
  - `processor`/`writer`와 `asyncProcessor`가 동일 체인에 섞일 경우 런타임 예측이 불가능한 문제.
  - 신규 Processor/Writer 조합(예: Kafka, WebClient)이 추가될 때마다 핵심 클래스(`StepSpec`)가 수정되어야 하는 문제.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 타입 위트니스 필수화 | `job.<I,O>step(...)` 명시적 선언 | Java 제네릭 한계상 람다 본문(반환형 void)만으로 `StepSpec<I, O>` 타입을 추론할 수 없으므로, 명시적 타입 위트니스를 강제하여 컴파일 안정성 확보 |
| Sync/Async 동시 설정 방지 | 내부 `Mode` (SYNC/ASYNC) 플래그 도입 | `processor()`와 `asyncProcessor()`를 섞어 쓸 경우 모호성을 제거하기 위해 상태 플래그 검증으로 예외 발생 (Fail-fast) |
| 확장 포인트 분리 (OCP) | `ProcessingSpec<I>` 전략 인터페이스 도입 | `SyncProcessingSpec`, `AsyncProcessingSpec`을 구현체로 분리하여 새 조합 추가 시 `StepSpec.build()`를 수정하지 않도록 설계. 새 전략은 해당 팩토리 메서드만 추가하면 됨 |
| 오버로드 모호성 회피 | `Writers.jdbc(...)` 등 정적 팩토리 클래스 분리 | `Consumer<WriterSpec>`와 `ItemWriter`를 동시 노출하면 람다 사용 시 컴파일러가 모호함을 느끼므로, 팩토리를 통해 명시적으로 의도 전달 |
| 배달 보장 / 재시도 / 실패 처리 | 기 정의된 프레임워크 기능 위임 | 순수 Spring Batch 네이티브 기능(`.configure(sb -> sb.faultTolerant().retry(...))`)에 위임하며, DLQ 라우팅 전용 메서드는 제공하지 않음 |
| 동시성 제어 (Thread-safety) | Async Mode에서 `PagingReader` 사용 시 경고 로그 | 멀티스레드 환경에서 Thread-safe(`saveState(false)`) 설정은 사용자 책임이나, 누락 방지를 위해 DSL 차원의 가드(경고 로그) 제공 |
| Reader 확장 일반화 및 탈출구 | `CursorReaderSpec`, `PagingReaderSpec` 동일 패턴 적용 | 전용 위임 빌더 및 `.and()` 복귀 패턴 확립. 각 Reader 빌더에도 `.configure(Consumer<Builder>)` 및 `raw()` 탈출구를 동일하게 유지 |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트 (`StepSpecTest`, `ReaderSpecTest` 등):
  - `StepSpec` 빌더가 `Mode` 제약 조건을 제대로 검증하는지 확인 (예: sync/async 혼합 시 `IllegalStateException` 발생).
  - Reader 미설정 및 chunkSize 미설정 시 `IllegalStateException` 예외 발생 검증.
  - 타입 위트니스를 적용한 DSL 코드가 정상적으로 컴파일되는지 확인.
  - `PagingReader`를 ASYNC 모드에서 `saveState` 명시적 설정 없이 사용 시 경고 로그 발생 확인.
- [ ] 통합테스트 (`StepSpecIT`, `ReaderSpecIT` 등):
  - 임베디드 DB(예: H2) 등 실제 `DataSource`를 띄워 `CursorReaderSpec` 및 `PagingReaderSpec`이 데이터를 올바르게 읽는지 증명 (Mock 경계 밖 실제 인프라 검증).
  - 구성된 DSL이 실제 `Job` 및 `Step` 인스턴스를 올바르게 생성하고 런타임에 빈으로 등록되는지 검증.
  - `.configure(sb -> sb.taskExecutor(customExecutor))`로 주입한 Executor가 실제 Step 실행 시점에 반영되는지 검증.
- [ ] 커버리지 기준: DSL 내부 코어 및 예외 분기 로직에 대해 80% 이상 보장.

## 미결 사항
- 없음.
