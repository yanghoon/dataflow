# Async API Sync Job 설계 스펙

## 가정 (Assumptions)
- **Mock 경계 및 통합 테스트**: 스펙에 명시된 '슬라이스 테스트'는 `@SpringBatchTest` 및 임베디드 H2를 사용하여 Reader, Step 조립, JobRepository 등의 실제 배선을 컨테이너 환경에서 검증하므로, 외부 API 클라이언트(Mock)를 제외한 나머지 인프라는 이미 실제 경로로 동작함을 가정한다.
- **테스트 파일 분리**: 이전 대화의 "클래스 1개, 메서드 2개" 합의에 따라, 유닛/통합 테스트 파일을 무조건 분리하지 않고 슬라이스 테스트 내에서 함께 검증하는 것을 허용한다.

## 목표
휴면 판정 대상 유저 정보를 읽어 외부 API와 동기화하는 배치 잡을 구축한다. 
비동기(`CompletableFuture`) 방식으로 외부 API를 호출하여 성능을 높이고, 성공 건과 실패 건을 동일 청크 트랜잭션 내에서 원자적으로 처리(Outbox 패턴 관점)한다.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: Spring Batch의 Chunk 기반 처리
- 신규로 가는 이유 (기존 걸로 안 되는 이유): 기존의 동기식 `ItemProcessor` 방식은 외부 API 호출 대기 시간으로 인해 대량 처리 시 병목이 발생함. Virtual Thread와 비동기 처리를 결합하여 I/O 대기 시간을 최소화하고, 프레임워크의 예외 던지기 방식이 아닌 자체 성공/실패 분리 및 롤백 방지 로직(Failure Log 적재)을 통해 부분 실패 시에도 전체 청크가 롤백되지 않고 유연하게 동작하도록 개선함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | At-least-once | 멱등성 보장은 API 호출부(`ExternalApiClient`)의 책임으로 위임. 실패 건은 `failure_log` 테이블에 저장하여 유실을 방지하고 추후 재처리 가능하도록 구성. |
| 동시성 제어 | Virtual Thread `ExecutorService` | `ItemProcessor`에서 API 호출을 Future로 반환하고 백그라운드 스레드에서 병렬 실행. 청크 단위로 Writer에서 `join()` 대기. |
| 실패/재시도 | Writer 내 실패 분리 및 DB 기록 (재시도는 주석만) | Spring Batch의 청크 재시도를 타지 않고 `AsyncCollectingWriter` 내부에서 발생한 `CompletionException`을 캐치. 실패 건은 `failureWriter`를 통해 `failure_log`에 기록. 당장 구체적인 재시도 로직은 구현하지 않으나, Writer 내부에 위치할 것임을 주석으로 명시. |
| 데이터 모델 | `failure_log` (item_key, error_message, created_at) | 실패 로그를 남기기 위한 범용/도메인 테이블 활용. |
| 파라미터 시간 결합 (절대/상대, 계산 위치) | 기준일: 상대값 (Job Parameter 기반 애플리케이션 계산) | 배치 실행 시 주입받은 Job Parameter(실행 일자)를 기준으로, 애플리케이션 레이어(Java)에서 휴면 판정 기준 날짜를 도출한 후 SQL 쿼리(ItemReader) 조건으로 주입(바인딩). |
| 주요 설정값 출처 | 설정 파일(`application.yml` 등) | 청크 사이즈 등을 하드코딩하지 않고 환경별 튜닝이 가능하도록 주입. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛/슬라이스 테스트 (동시성 및 분기 검증):
  - Async Writer/Processor 조합이 실제로 (1) 동시 실행되어 처리시간이 단축되는지, (2) 성공건은 지정된 카운트만큼 성공 테이블에 반영되는지, (3) 실패건은 DLQ 테이블에 정확히 적재되는지를 검증한다.
  - 외부 API 호출은 Mockito로 대체해 각 호출에 100ms 지연을 부여한다.
  - 5건의 데이터를 순차 처리하면 500ms가 걸리지만, 동시 처리 시 200ms 이내에 완료되어야 함을 '실행시간 임계값'으로 단언(Assert)한다.
  - CSV 초기 데이터(테스트 픽스처)는 임베디드 H2 DB에 사전 적재하여 Reader 대상 행을 구성한다.
- [ ] 커버리지 기준: 80% 이상

## 미결 사항
- 실패 건(`failure_log` 데이터)에 대한 구체적인 후속 재처리 파이프라인/배치는 이번 스코프에서 제외(추후 논의 필요).

## 주요 샘플 코드 (참고용)
구현 시 참고할 핵심 컴포넌트 및 검증 로직의 샘플 코드입니다.

### 1. `Result` Record
```java
/**
 * 두 값을 담는 범용 홀더. (item, future) 페어링 및 실패 결과 용도.
 */
public record Result<T1, T2>(T1 first, T2 second) {
    public boolean isError() {
        return second instanceof Throwable;
    }
}
```

### 2. `AsyncWrapperProcessor`
```java
/**
 * delegate를 비동기로 감싸서 CompletableFuture로 반환. 예외는 전파함.
 */
public class AsyncWrapperProcessor<I, O> implements ItemProcessor<I, Result<I, CompletableFuture<O>>> {
    private final ItemProcessor<I, O> delegate;
    private final ExecutorService executor;

    public AsyncWrapperProcessor(ItemProcessor<I, O> delegate, ExecutorService executor) {
        this.delegate = delegate;
        this.executor = executor;
    }

    @Override
    public Result<I, CompletableFuture<O>> process(I item) {
        CompletableFuture<O> future = CompletableFuture.supplyAsync(() -> {
            try {
                return delegate.process(item);
            } catch (Exception e) {
                throw new CompletionException(e);
            }
        }, executor);
        return new Result<>(item, future);
    }
}
```

### 3. `AsyncCollectingWriter`
```java
/**
 * 청크로 넘어온 future 목록을 join()하며 성공/실패를 분리, 같은 청크 트랜잭션 안에서 커밋/롤백.
 */
public class AsyncCollectingWriter<I, O> implements ItemWriter<Result<I, CompletableFuture<O>>> {
    private final ItemWriter<O> delegateWriter;
    private final ItemWriter<Result<I, Throwable>> failureWriter;
    private volatile int lastFailureCount = 0;

    public AsyncCollectingWriter(ItemWriter<O> delegateWriter, ItemWriter<Result<I, Throwable>> failureWriter) {
        this.delegateWriter = delegateWriter;
        this.failureWriter = failureWriter;
    }

    @Override
    public void write(Chunk<? extends Result<I, CompletableFuture<O>>> chunk) throws Exception {
        List<O> success = new ArrayList<>();
        List<Result<I, Throwable>> failures = new ArrayList<>();

        for (Result<I, CompletableFuture<O>> entry : chunk.getItems()) {
            try {
                success.add(entry.second().join());
            } catch (CompletionException e) {
                // TODO: 재시도 처리는 여기서 구현 (현재는 주석만 남김)
                failures.add(new Result<>(entry.first(), e.getCause()));
            }
        }

        if (!success.isEmpty()) delegateWriter.write(new Chunk<>(success));
        if (!failures.isEmpty()) failureWriter.write(new Chunk<>(failures));

        this.lastFailureCount = failures.size();
    }
    
    public int getLastFailureCount() { return lastFailureCount; }
}
```

### 4. 슬라이스 테스트 (`AsyncApiStepTest`) 의도 요약
- **동시성 검증**: Mock API 호출에 100ms 지연 설정 후, 5건 처리 시 500ms(순차)가 아닌 200ms(병렬) 이내에 끝나는지 `elapsed < 200`으로 검증.
- **분기 검증**: 전건 성공 시 `success_log` 수 일치 여부 확인. 일부 실패(특정 ID 타임아웃 유도) 시 `failure_log` 단일 적재 및 나머지는 성공 유지 여부 확인.
- **초기 데이터**: 임베디드 H2 DB 및 `test-users.csv`를 활용하여 대상 행을 구성.
