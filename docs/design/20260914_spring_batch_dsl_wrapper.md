# Spring Integration 스타일 Batch DSL 설계 스펙

## 1. 목적 및 배경
- **문제 정의**: 기존 스프링 배치는 Job, Step, Reader, Processor, Writer를 각각 독립된 빈(Bean)과 빌더로 파편화하여 작성해야 하므로 전체 파이프라인의 흐름을 한눈에 파악하기 어렵습니다.
- **해결 방안**: 스프링 인테그레이션(Spring Integration)의 `IntegrationFlows` DSL 스타일을 차용하여, 단일 체이닝(Method Chaining)과 람다(Lambda)를 통해 하나의 선언문으로 Job과 다수의 Step 흐름을 구성합니다.
- **특징**: 커스텀 헬퍼 스펙(Spec) 객체를 억지로 만들지 않고, **스프링 배치의 기본 빌더(`SimpleStepBuilder`)를 람다에 직접 주입**하여 프레임워크의 순정 API(예: `.faultTolerant()`, `.listener()`)를 100% 활용합니다.

## 2. 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 호환성 (Spring Batch 5 & 6) | `JobRepository`, `PlatformTransactionManager` 명시적 주입 | Spring Batch 5부터 팩토리가 제거되고(6도 동일 기조) 명시적 주입이 필수화된 표준 API 준수 |
| Writer 시그니처 (SB 5+) | `ItemWriter.write(Chunk<? extends T>)` 사용 | Spring Batch 5부터 `List` 대신 `Chunk` 타입 사용 필수 (4.3.x 시그니처 사용 시 컴파일 에러) |
| 핵심 래퍼 객체 | `BatchFlow`, `BatchJobBuilder`, `BatchStepBuilder` | 불필요한 Wrapper 클래스(`ChunkFlowSpec` 등)를 완전히 제거하여 극단적으로 간소화 |
| 오케스트레이션 | `.job().start().next().build()` 체이닝 | 다중 Step 파이프라인 흐름을 한눈에 직관적으로 작성하도록 지원 |
| 인프라 호환성 | `Consumer<SimpleStepBuilder<I, O>>` 사용 | 람다 안에서 Spring Batch 순정 API를 그대로 사용하므로 확장성 무한대 보장 |
| TxManager 오버로딩 | `start(name, customTx, step -> ...)` 추가 | 기본적으로 Job 레벨 TxManager를 공유하되, 필요한 Step만 별도의 TxManager를 주입할 수 있도록 유연성 확보 |
| 단일 컴포넌트 처리 | `.processor(unified) .writer(unified)` | 동일한 인스턴스를 각각 주입하여 상태를 공유하는 가장 명시적이고 깔끔한 방법 사용 |

## 3. 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 통합테스트: `BatchFlowIT.java`
  - **테스트 시나리오**: `AccountDormancyBatchConfig` 형태의 Job Config를 작성하고, `target_accounts.csv` 파일을 읽어 Tasklet까지 연결되는 전체 다중 스텝 흐름을 테스트한다.

## 4. 엔진 상세 설계 (Core Engine)

불필요한 래퍼를 걷어내고 프레임워크 순정 빌더를 람다로 공급하는 최종 형태입니다.
Job 레벨에 공통 `txManager`를 선언하되, Step별로 다르게 주입할 수 있는 오버로딩이 포함되어 있습니다.

```java
package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.core.repository.JobRepository;
import org.springframework.transaction.PlatformTransactionManager;

public class BatchFlow {
    public static BatchJobBuilder job(String name, JobRepository jobRepository, PlatformTransactionManager txManager) {
        return new BatchJobBuilder(name, jobRepository, txManager);
    }
}
```

```java
package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.job.builder.SimpleJobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.function.Consumer;

public class BatchJobBuilder {
    private final JobBuilder jobBuilder;
    private final JobRepository jobRepository;
    private final PlatformTransactionManager txManager;
    private SimpleJobBuilder simpleJobBuilder;

    public BatchJobBuilder(String name, JobRepository jobRepository, PlatformTransactionManager txManager) {
        this.jobBuilder = new JobBuilder(name, jobRepository);
        this.jobRepository = jobRepository;
        this.txManager = txManager;
    }

    // 1. 공통 TxManager를 사용하는 기본 메서드
    public BatchJobBuilder start(String stepName, Consumer<BatchStepBuilder> stepConfigurer) {
        return start(stepName, this.txManager, stepConfigurer);
    }

    // 2. 개별 TxManager 주입을 허용하는 오버로딩 메서드
    public BatchJobBuilder start(String stepName, PlatformTransactionManager customTxManager, Consumer<BatchStepBuilder> stepConfigurer) {
        if (customTxManager == null) {
            throw new IllegalArgumentException("PlatformTransactionManager는 Step 생성 시 필수입니다.");
        }
        BatchStepBuilder stepBuilder = new BatchStepBuilder(stepName, jobRepository, customTxManager);
        stepConfigurer.accept(stepBuilder);
        this.simpleJobBuilder = this.jobBuilder.start(stepBuilder.build());
        return this;
    }

    public BatchJobBuilder next(String stepName, Consumer<BatchStepBuilder> stepConfigurer) {
        return next(stepName, this.txManager, stepConfigurer);
    }

    public BatchJobBuilder next(String stepName, PlatformTransactionManager customTxManager, Consumer<BatchStepBuilder> stepConfigurer) {
        if (customTxManager == null) {
            throw new IllegalArgumentException("PlatformTransactionManager는 Step 생성 시 필수입니다.");
        }
        BatchStepBuilder stepBuilder = new BatchStepBuilder(stepName, jobRepository, customTxManager);
        stepConfigurer.accept(stepBuilder);
        this.simpleJobBuilder.next(stepBuilder.build());
        return this;
    }

    public Job build() {
        return this.simpleJobBuilder.build();
    }
}
```

```java
package io.slim.ingestion.batch.config.dsl;

import org.springframework.batch.core.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.SimpleStepBuilder;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.function.Consumer;

public class BatchStepBuilder {
    private final StepBuilder stepBuilder;
    private final PlatformTransactionManager txManager;
    private Step finalStep;

    public BatchStepBuilder(String name, JobRepository jobRepository, PlatformTransactionManager txManager) {
        this.stepBuilder = new StepBuilder(name, jobRepository);
        this.txManager = txManager;
    }

    public void tasklet(Tasklet tasklet) {
        this.finalStep = this.stepBuilder.tasklet(tasklet, txManager).build();
    }

    // 스프링 배치의 SimpleStepBuilder를 람다로 직접 제공
    public <I, O> void chunk(int chunkSize, Consumer<SimpleStepBuilder<I, O>> chunkConfigurer) {
        SimpleStepBuilder<I, O> chunkBuilder = this.stepBuilder.chunk(chunkSize, txManager);
        chunkConfigurer.accept(chunkBuilder);
        this.finalStep = chunkBuilder.build(); // 조립 완료 후 엔진이 build() 호출
    }

    public Step build() {
        return this.finalStep;
    }
}
```

## 5. 통합 컴포넌트 및 적용 샘플

Spring Batch 5의 `Chunk` 시그니처를 반영한 통합 컴포넌트(`ItemReader`, `ItemProcessor`, `ItemWriter`, `ItemStream` 단일 구현체)와 이를 DSL로 엮어낸 샘플입니다.

### 5.1. 통합 컴포넌트 (`IcebergAccountDormancyComponent`)

```java
package io.slim.ingestion.batch.config;

import org.springframework.batch.item.Chunk;
import org.springframework.batch.item.ExecutionContext;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.ItemStream;
import org.springframework.batch.item.ItemWriter;
import org.springframework.stereotype.Component;
import java.util.Iterator;
import java.util.List;

@Component
public class IcebergAccountDormancyComponent
        implements ItemReader<AccountRow>, ItemProcessor<AccountRow, DormantCommand>,
                   ItemWriter<DormantCommand>, ItemStream {

    private Iterator<AccountRow> cursor;
    private int readCount = 0;

    @Override
    public void open(ExecutionContext ec) {
        Object restarted = ec.get("read.count");
        this.readCount = restarted != null ? (int) restarted : 0;
        this.cursor = openIcebergScan().iterator();
    }

    @Override
    public AccountRow read() {
        if (!cursor.hasNext()) return null;
        readCount++;
        return cursor.next();
    }

    @Override
    public void update(ExecutionContext ec) {
        ec.put("read.count", readCount);
    }

    @Override
    public void close() { /* 커서/리소스 반납 */ }

    @Override
    public DormantCommand process(AccountRow item) {
        if (!item.isDormancyEligible()) return null; // Skip
        return new DormantCommand(item.getAccountId());
    }

    @Override
    public void write(Chunk<? extends DormantCommand> items) { // Spring Batch 5 시그니처
        for (DormantCommand cmd : items) {
            persistDormantCommand(cmd);
        }
    }

    private List<AccountRow> openIcebergScan() { return List.of(); }
    private void persistDormantCommand(DormantCommand cmd) { }
}
```

### 5.2. 파이프라인 구성 (`AccountDormancyBatchConfig`)

`PlatformTransactionManager`를 Job 선언부에 한 번만 주입하고, 필요하다면 `.next(stepName, customTxManager, step -> ...)` 처럼 오버라이딩 할 수 있습니다.

```java
package io.slim.ingestion.batch.config;

import io.slim.ingestion.batch.config.dsl.BatchFlow;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.item.file.FlatFileItemReader;
import org.springframework.batch.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class AccountDormancyBatchConfig {

    @Bean
    public Job accountDormancyPipelineJob(JobRepository jobRepository, 
                                          PlatformTransactionManager txManager,
                                          IcebergAccountDormancyComponent unifiedComponent) {

        return BatchFlow.job("accountDormancyPipelineJob", jobRepository, txManager)
                
                // 기본 txManager 사용
                .start("processDormancyDataStep", step -> step
                        .<AccountRow, DormantCommand>chunk(1000, chunk -> chunk 
                                .reader(csvFileReader())
                                .processor(unifiedComponent) 
                                .writer(unifiedComponent)
                                .faultTolerant() 
                                .skipLimit(10)
                                .skip(IllegalArgumentException.class)
                        )
                )
                
                // 만약 이 Step만 별도 DataSource의 TxManager가 필요하다면 오버로딩 버전 사용 가능
                // .next("specialTxStep", specialJpaTxManager, step -> step...)
                
                .next("syncMetadataStep", step -> step
                        .tasklet((contribution, chunkContext) -> {
                            System.out.println("Iceberg 메타데이터 카탈로그 동기화 완료");
                            return org.springframework.batch.repeat.RepeatStatus.FINISHED;
                        })
                )
                
                .build(); 
    }

    private FlatFileItemReader<AccountRow> csvFileReader() {
        return new FlatFileItemReaderBuilder<AccountRow>()
                .name("accountCsvReader")
                .resource(new ClassPathResource("data/target_accounts.csv"))
                .delimited()
                .names("accountId", "lastActivityDate", "status")
                .targetType(AccountRow.class)
                .build();
    }
}
```

## 6. `@StepScope` 및 생명주기 관련 엄밀한 검토 (트러블슈팅 가이드)

우리가 고안한 `BatchFlow` DSL은 런타임 빈의 생명주기에 개입하지 않는 순수한 설정 조립체이므로 프록시의 지연 생성(Late Binding) 메커니즘을 100% 온전히 지원하며 `@StepScope`와 완벽히 호환됩니다. 

다만, 스프링 배치 커뮤니티에서 자주 보고되는 **"프록시에 의한 생명주기 인터페이스 은닉 현상"**을 실무 적용 시 반드시 인지해야 합니다.

### ⚠️ 문제 상황 (Proxy Hiding)
`unifiedComponent` 객체가 리소스 관리(open/close)를 위해 `ItemStream`을 구현했다고 가정해 봅시다. 
Spring Batch의 `SimpleStepBuilder`는 주입된 객체가 `ItemStream` 타입인지 `instanceof`로 검사하여 내부적으로 자동 등록하려 시도합니다. 
하지만 해당 빈이 `@StepScope`로 지정되어 스프링 컨테이너가 가짜 프록시(Proxy) 객체를 만들어 넘길 때, 빈의 선언된 반환 타입(`@Bean public ItemProcessorWriter...`)에 `ItemStream` 인터페이스가 명시되어 있지 않다면, **생성된 프록시는 `ItemStream` 인터페이스를 외부로 노출하지 않습니다.**
그 결과, 빌더가 자동 감지에 실패하여 배치 실행 시 `open()`, `close()`가 단 한 번도 호출되지 않는 심각한 오류(예: 파일 미생성, DB 커서 닫힘 누락 등)가 발생하게 됩니다.

### 💡 해결 방안 (순정 API의 강력함)
다행히 우리는 중간 래퍼 객체(`ChunkFlowSpec`)를 쓰지 않고, **스프링 배치의 순정 `SimpleStepBuilder` 자체를 람다에 그대로 노출**시켰습니다. 따라서 프레임워크의 불안전한 자동 감지에 의존할 필요 없이, 아래와 같이 람다 내부에서 제공되는 `.stream()`이나 `.listener()` 메서드를 통해 직접 명시적으로 등록할 수 있습니다.

```java
.start("processDormancyDataStep", step -> step
        .<AccountRow, DormantCommand>chunk(1000, chunk -> chunk 
                .reader(csvFileReader())
                .processor(unifiedComponent) 
                .writer(unifiedComponent)
                // 프록시에 의해 ItemStream 인터페이스가 가려지더라도,
                // 순정 API를 직접 호출해 명시적으로 강제 등록하면 완벽하게 동작합니다.
                .stream(unifiedComponent) 
                .listener(unifiedComponent)
        )
)
```

> **검토 결과 부연설명**: `processor`, `writer`, `stream` 등에 동일한 프록시 인스턴스 참조를 3번, 4번 반복해서 주입하더라도 걱정할 필요가 없습니다. Spring Batch의 내부는 이를 `Set`(정확히는 동일 인스턴스 여부 판별)으로 관리하므로 중복 등록되어 `open()`이 두 번 중복 호출되는 일은 결코 발생하지 않습니다.
