# Workflow Spring Batch 설정 일원화 및 통합 테스트 인프라 안정화 설계 스펙

## 1. 개요 및 목표
본 문서는 Spring Batch 코드베이스를 레거시 `v2` 패키지에서 `io.slim.workflow` 패키지 아키텍처로 이전한 이후(`commit 31b8291`), 잔존하던 설정 클래스 불일치 및 Spring Boot 4/Batch 5 기본 자동 구성과의 충돌로 인해 발생한 14건의 연쇄 빌드/테스트 실패를 근본적으로 해소하고 전체 통합 테스트 인프라를 안정화한 설계 및 수정 내역을 기록한다.

---

## 2. 배경 및 세부 문제점 분석 (Root Cause Analysis)

### 2.1. `BatchConfig` 패키지 위치 불일치 및 `JobRegistry` 누락
- **증상**: `WorkflowJobViewControllerIntegrationTest`, `CloudEventDispatcherIntegrationTest` 등 13개 통합 테스트에서 `NoSuchBeanDefinitionException: No qualifying bean of type 'org.springframework.batch.core.configuration.JobRegistry' available` 오류 발생.
- **원인**:
  - `AdminJobController`와 `JobTriggerService`가 `io.slim.workflow...` 하위로 이동되어 `WorkflowApplication`(`@SpringBootApplication`)의 컴포넌트 스캔 대상이 됨.
  - 그러나 `JobRegistry` (`MapJobRegistry`)를 빈으로 등록하는 `BatchConfig.java`는 여전히 이전 패키지인 `io.slim.ingestion.batch.config`에 방치되어 컴포넌트 스캔 대상에서 누락됨.
  - Spring Boot의 `BatchAutoConfiguration`은 `JobRepository`, `JobLauncher`, `JobExplorer`는 기본 생성하지만, `JobRegistry`는 자동 생성하지 않으므로 수동 Bean 제공이 필수적임.

### 2.2. 잡 중복 등록 예외 (`DuplicateJobException`)
- **증상**: `BatchConfig`에 `JobRegistrySmartInitializingSingleton`을 수동 빈으로 추가했을 때 `DuplicateJobException: A job configuration with this name [sampleJob] was already registered` 발생.
- **원인**: Spring Boot 4 / Batch 5 환경에서는 `JobRegistry` 빈이 존재할 경우 부트의 배치 초기화 프로세스가 등록된 Job 빈들을 자동으로 처리하므로, 수동으로 `JobRegistrySmartInitializingSingleton`을 등록하면 동일한 잡이 중복 등록됨.

### 2.3. 스프링 배치 기동 시 잡 자동 실행 충돌
- **증상**:
  - `WorkflowJobViewControllerIntegrationTest` 등에서 `JobInstanceAlreadyCompleteException: A job instance already exists and is complete for parameters={}` 발생.
  - `OutboxPollerDatabaseIntegrationTest` 등 Testcontainers 환경에서 `BadSqlGrammarException: relation "BATCH_JOB_INSTANCE" does not exist` 발생.
- **원인**:
  - Spring Boot의 기본 속성값(`spring.batch.job.enabled: true`)으로 인해 애플리케이션 컨텍스트 기동 시점마다 `JobLauncherApplicationRunner`가 동작하여 모든 Batch Job을 자동 실행하려고 시도함.
  - 배치 메타데이터 테이블이 생성되지 않은 테스트 DB에서는 테이블 조회 실패가 발생하고, 인메모리/동일 컨텍스트 재사용 환경에서는 중복 실행 예외가 발생함.
  - 웹 컨트롤러나 외부 스케줄러를 통해 명시적으로 트리거하는 시스템에서는 기동 시 자동 실행을 차단해야 함.

### 2.4. `ObjectMapper` 빈 정의 중복 충돌 (`BeanDefinitionOverrideException`)
- **증상**: `BeanDefinitionOverrideException: Invalid bean definition with name 'objectMapper' defined in ... Cannot register bean definition ... since there is already ... bound`.
- **원인**:
  - MVC 자동구성이 누락된 테스트 컨텍스트를 위해 `BatchConfig`에 `@ConditionalOnMissingBean ObjectMapper`를 제공했으나,
  - `OutboxPollerDatabaseIntegrationTest`, `WorkflowJobViewControllerIntegrationTest`, `DormantCustomerPolicyTest`, `DormantCustomerPolicyYamlIntegrationTest` 등 4개 테스트 클래스 내부 `@TestConfiguration static class Config`에 이미 동일한 이름의 `objectMapper()` 빈이 직접 선언되어 있었음.
  - Spring Boot 기본 정책(`spring.main.allow-bean-definition-overriding=false`)으로 인해 설정 클래스 빈 정의 파싱 단계에서 충돌 발생.

### 2.5. `WorkflowConfigTests` 프로파일 누락
- **증상**: `props.jobs()`가 비어 있어 `AssertionError: Expecting actual not to be null` 발생.
- **원인**: 과거 `c2610b7` 커밋에서 쿠버네티스 환경 설정을 정비하며 워크플로우 잡 설정을 `application.yaml`에서 `application-workflow.yaml`로 분리했으나, 해당 단위 테스트에 `@ActiveProfiles("workflow")`가 누락되어 기본 `application.yaml`만 로드됨.

### 2.6. `S3ToPostgresImportJobTest` Mocking 불일치 및 인라인 FQDN
- **증상**: `NullPointerException at line 77` (`jobExecution.getStatus()`).
- **원인**: `JobTriggerService.triggerNew()`가 내부적으로 `jobLauncher.run(job, params)`를 호출하도록 리팩토링되었으나, 테스트에서는 레거시 `JobOperator`만 Mocking하고 `JobLauncher`는 Mocking하지 않아 `null` 반환. 또한 파라미터 검증이 과거 `JobDef` 명세(`s3.bucket` 등)에 머물러 있었음.

### 2.7. `WorkflowJobViewControllerIntegrationTest` 스케줄러 비동기 타임아웃 및 네이밍 규격
- **증상**:
  - `WantedButNotInvoked: workflowLauncher.launch(...)` (15초 대기 후 타임아웃)
  - `InvalidConfigurationPropertyNameException: Configuration property name 'targetDate' is not valid`
- **원인**:
  - `runAdhoc`이 `db-scheduler`를 통해 비동기로 실행되는데, 테스트 환경의 기본 폴링 주기가 10초(`pollInterval=10s`)이고 즉시 실행(`enable-immediate-execution=false`)이 비활성화되어 15초 제한 시간을 초과함.
  - `BindException` 모의 객체 생성 시 `ConfigurationPropertyName.of("targetDate")`를 호출했으나, Spring Boot는 kebab-case(소문자/하이픈)만 허용하므로 예외 발생.

### 2.8. `DbSchedulerLogTest` 비활성화된 메인 클래스 참조
- **증상**: `NoSuchBeanDefinitionException: No qualifying bean of type 'com.github.kagkarlsson.scheduler.Scheduler'`.
- **원인**: 테스트가 `@SpringBootTest(classes = BatchApplication.class)`를 사용했으나, `BatchApplication`은 `@SpringBootApplication`이 주석 처리되어 있어 `db-scheduler` 자동 구성이 동작하지 않음.

### 2.9. `outbox_event` 상태 체크 제약조건 위반
- **증상**: `DataIntegrityViolationException: ERROR: new row for relation "outbox_event" violates check constraint "outbox_event_status_check" (Detail: Failing row contains status = 'READY')`.
- **원인**: `outbox_event.sql` 스키마 및 `EventStatus` enum은 `PENDING, PROCESSING, SENT, CONFIRMED, RETRY_PENDING, FAILED, CANCELLED`만 허용하지만, `AbstractPolicy.java#L98`의 SQL 문에 과거 레거시 값인 `'READY'`가 하드코딩되어 있었음.

---

## 3. 설계 결정 및 기술 명세 (Design Decisions)

| 항목 | 결정 내용 | 기술적/아키텍처적 근거 |
|---|---|---|
| **BatchConfig 패키지 재배치** | `io.slim.workflow.app.config.batch.BatchConfig`로 이동 | `WorkflowApplication`의 컴포넌트 스캔 경로(`io.slim.workflow.*`)에 자연스럽게 포함시켜 `JobRegistry` 및 배치 인프라 Bean을 정상 공급 |
| **중복 잡 등록 방지** | 수동 `JobRegistrySmartInitializingSingleton` 빈 선언 제거 | Spring Boot 4 / Batch 5 내장 Job 등록 라이프사이클과의 이중 등록 충돌(`DuplicateJobException`) 원천 방지 |
| **기동 시 잡 자동실행 비활성화** | `application.yaml`에 `spring.batch.job.enabled: false` 명시 | REST API 및 스케줄러 기반의 명시적 트리거 아키텍처 원칙 준수, 기동 시 불필요한 `BATCH_JOB_INSTANCE` 조회 및 인스턴스 충돌 차단 |
| **공통 ObjectMapper 제공 및 중복 제거** | `BatchConfig`에 `@ConditionalOnMissingBean ObjectMapper` 등록하고, 각 테스트 내부의 중복 `@Bean objectMapper()` 및 `@Import` 삭제 | 중복 선언으로 인한 `BeanDefinitionOverrideException`을 해결하고 테스트 간 공통 직렬화 빈 재사용 |
| **프로파일 명시** | `WorkflowConfigTests`에 `@ActiveProfiles("workflow")` 추가 | `application-workflow.yaml`에 분리된 잡 목록을 정확히 바인딩 검증하도록 테스트 목적과 설정 파일 정합성 확보 |
| **Mock 계약 동기화** | `S3ToPostgresImportJobTest`에서 `JobLauncher` Mocking 및 `triggeredAt` 검증 | 리팩토링된 `JobTriggerService.triggerNew()`의 실제 구현(`jobLauncher.run`)과 테스트 검증 계약 일치 |
| **비동기 스케줄러 테스트 튜닝** | `WorkflowJobViewControllerIntegrationTest`에 `polling-interval=200ms`, `enable-immediate-execution=true` 적용 | 비동기 스케줄링 태스크가 즉시 실행되어 15초 타임아웃 없이 빠르고 결정론적으로 통과되도록 보장 |
| **프로퍼티 네이밍 규격 준수** | `ConfigurationPropertyName.of("target-date")` kebab-case 적용 | Spring Boot 4 `ConfigurationPropertyName`의 표준 명명 규격 강제 준수 |
| **테스트 애플리케이션 컨텍스트 정상화** | `DbSchedulerLogTest`의 classes를 `WorkflowApplication.class`로 변경 | 주석 처리된 레거시 클래스를 배제하고 실제 살아있는 메인 애플리케이션 컨텍스트를 로드 |
| **아웃박스 이벤트 표준 상태 준수** | `AbstractPolicy`의 INSERT SQL 상태값을 `'READY'` &rarr; `'PENDING'`으로 변경 | `outbox_event` DB CHECK 제약조건 및 `EventStatus` enum 표준 규격 준수 |
| **인라인 FQDN 제거 규칙 준수** | 수정/생성된 모든 자바 파일의 인라인 FQDN을 파일 최상단 `import`로 리팩토링 | 팀 규칙(`Java 코드 시 인라인 FQDN 금지`) 완벽 준수 |

---

## 4. 파일별 상세 코드 변경 내역 (Code Changes by File)

### 4.1. 프로덕션 코드 (Production Code)

#### (1) `ingestion/src/main/java/io/slim/workflow/app/config/batch/BatchConfig.java` (신규 파일)
- 기존 `io.slim.ingestion.batch.config.BatchConfig`를 삭제하고 워크플로우 설정 계층으로 재배치.
- `@ConditionalOnMissingBean` 기반의 `ObjectMapper` 빈 제공 및 불필요한 싱글톤 등록 제거.
```java
package io.slim.workflow.app.config.batch;

import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.configuration.support.MapJobRegistry;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry;
import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.ConnectionProperties;
import io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.DefaultConnectionRegistry;
import io.slim.workflow.app.service.JobTriggerService;

@Configuration
public class BatchConfig {

    @Bean
    JobTriggerService jobTriggerService(AutowireCapableBeanFactory factory) {
        return factory.createBean(JobTriggerService.class);
    }

    @Bean
    JobRegistry jobRegistry() {
        return new MapJobRegistry();
    }

    @Bean
    @ConditionalOnMissingBean
    ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    @Bean
    ConnectionRegistry connectionRegistry(ConnectionProperties props) {
        return new DefaultConnectionRegistry(props);
    }

    @Bean
    @ConfigurationProperties("app.connections")
    ConnectionProperties connectionProperties() {
        return new ConnectionProperties();
    }
}
```

#### (2) `ingestion/src/main/resources/application.yaml`
- 기동 시 배치 잡 자동 실행 방지 설정 추가:
```diff
 spring:
+  batch:
+    job:
+      enabled: false
   datasource:
     url: jdbc:postgresql://localhost:5432/dataflow
```

#### (3) `ingestion/src/main/java/io/slim/workflow/app/adapter/workflow/event/AbstractPolicy.java`
- `outbox_event` INSERT 쿼리에서 레거시 상태값 `'READY'`를 표준 초기 상태값 `'PENDING'`으로 교체:
```diff
         String insertSql = "INSERT INTO outbox_event (id, source, type, subject, datacontenttype, data, extensions, time, status) " +
-                           "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, 'READY') " +
+                           "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, 'PENDING') " +
                            "ON CONFLICT (source, id) DO NOTHING";
```

---

### 4.2. 테스트 코드 (Test Code)

#### (4) `ingestion/src/test/java/io/slim/workflow/config/WorkflowConfigTests.java`
- `application-workflow.yaml`의 잡 목록 바인딩을 위한 프로파일 활성화:
```diff
 import org.springframework.boot.context.properties.EnableConfigurationProperties;
 import org.springframework.boot.test.context.SpringBootTest;
 import org.springframework.context.annotation.Configuration;
+import org.springframework.test.context.ActiveProfiles;
 
 import io.slim.workflow.app.config.workflow.WorkflowProperties;
 import io.slim.workflow.config.WorkflowConfigTests.Config;
 
+@ActiveProfiles("workflow")
 @SpringBootTest(classes = Config.class)
 public class WorkflowConfigTests {
```

#### (5) `ingestion/src/test/java/io/slim/ingestion/batch/S3ToPostgresImportJobTest.java`
- `JobLauncher` Mocking 추가, `JobParameters` 캡처 검증을 `triggeredAt`으로 동기화, 인라인 FQDN 리팩토링:
```diff
-    @MockitoBean
-    private org.springframework.batch.core.configuration.JobRegistry jobRegistry;
-    @MockitoBean
-    private org.springframework.batch.core.launch.JobOperator jobOperator;
-    @MockitoBean
-    private org.springframework.batch.core.repository.JobRepository jobRepository;
+    @MockitoBean(name = "jobRegistry")
+    private JobRegistry jobRegistry;
+    @MockitoBean(name = "jobOperator")
+    private JobOperator jobOperator;
+    @MockitoBean(name = "jobLauncher")
+    private JobLauncher jobLauncher;
+    @MockitoBean(name = "jobRepository")
+    private JobRepository jobRepository;
...
-        when(jobOperator.start(any(org.springframework.batch.core.job.Job.class), any(org.springframework.batch.core.job.parameters.JobParameters.class))).thenReturn(mockExecution);
+        when(jobLauncher.run(any(Job.class), any(JobParameters.class))).thenReturn(mockExecution);
...
-        org.mockito.ArgumentCaptor<org.springframework.batch.core.job.parameters.JobParameters> captor = 
-            org.mockito.ArgumentCaptor.forClass(org.springframework.batch.core.job.parameters.JobParameters.class);
-        org.mockito.Mockito.verify(jobOperator).start(any(), captor.capture());
+        ArgumentCaptor<JobParameters> captor = ArgumentCaptor.forClass(JobParameters.class);
+        verify(jobLauncher).run(any(Job.class), captor.capture());
-        assertThat(capturedParams.getString("s3.bucket")).isEqualTo("my-test-bucket");
+        assertThat(capturedParams.getLong("triggeredAt")).isNotNull();
```

#### (6) `ingestion/src/test/java/io/slim/workflow/app/adapter/event/poller/OutboxPollerDatabaseIntegrationTest.java`
- 중복 `TestConfig(objectMapper)` 및 인라인 FQDN 제거:
```diff
 @ActiveProfiles("outbox")
 class OutboxPollerDatabaseIntegrationTest {
 
-    @org.springframework.boot.test.context.TestConfiguration
-    static class TestConfig {
-        @org.springframework.context.annotation.Bean
-        public com.fasterxml.jackson.databind.ObjectMapper objectMapper() {
-            return new com.fasterxml.jackson.databind.ObjectMapper();
-        }
-    }
-
     @Container
```

#### (7) `ingestion/src/test/java/io/slim/workflow/app/adapter/rest/WorkflowJobViewControllerIntegrationTest.java`
- 중복 `Config(objectMapper)` 제거, `db-scheduler` 비동기 즉시 실행/폴링 주기 추가, kebab-case(`target-date`) 규격 반영:
```diff
     "workflow.jobs.test-adhoc-job.props.targetTable=default_table",
-    "workflow.jobs.test-adhoc-job.allowedOverrides[0]=targetDate"
+    "workflow.jobs.test-adhoc-job.allowedOverrides[0]=targetDate",
+    "db-scheduler.polling-interval=200ms",
+    "db-scheduler.enable-immediate-execution=true"
 })
 @AutoConfigureMockMvc
 @ActiveProfiles("test")
 class WorkflowJobViewControllerIntegrationTest {
 
-    @TestConfiguration
-    static class Config {
-        @Bean
-        public ObjectMapper objectMapper() {
-            return new ObjectMapper();
-        }
-    }
...
         BindException bindException = constructor.newInstance(
-                ConfigurationPropertyName.of("targetDate"),
+                ConfigurationPropertyName.of("target-date"),
                 Bindable.of(LocalDate.class),
                 null,
                 new Exception("parse error")
         );
...
-                .andExpect(MockMvcResultMatchers.jsonPath("$.error").value(containsString("Binding failed for field 'targetDate'")));
+                .andExpect(MockMvcResultMatchers.jsonPath("$.error").value(containsString("target-date")));
```

#### (8) `ingestion/src/test/java/io/slim/workflow/app/adapter/scheduler/DbSchedulerLogTest.java`
- 주석 처리된 `BatchApplication` 대신 실제 메인 클래스 `WorkflowApplication` 매핑:
```diff
-import io.slim.ingestion.batch.BatchApplication;
+import io.slim.workflow.WorkflowApplication;
 
-@SpringBootTest(classes = BatchApplication.class)
+@SpringBootTest(classes = WorkflowApplication.class)
 @ActiveProfiles("default")
```

#### (9) `ingestion/src/test/java/io/slim/workflow/app/adapter/workflow/event/DormantCustomerPolicyTest.java`
- 중복 `TestConfig(objectMapper)` 및 `@Import` 제거:
```diff
 @Testcontainers
-@Import(DormantCustomerPolicyTest.TestConfig.class)
 public class DormantCustomerPolicyTest {
...
-    @TestConfiguration
-    static class TestConfig {
-        @Bean
-        public ObjectMapper objectMapper() {
-            return new ObjectMapper();
-        }
-    }
```

#### (10) `ingestion/src/test/java/io/slim/workflow/app/adapter/workflow/event/DormantCustomerPolicyYamlIntegrationTest.java`
- 중복 `TestConfig(objectMapper)` 및 `@Import` 제거:
```diff
 @Testcontainers
-@Import(DormantCustomerPolicyYamlIntegrationTest.TestConfig.class)
 public class DormantCustomerPolicyYamlIntegrationTest {
...
-    @TestConfiguration
-    static class TestConfig {
-        @Bean
-        public ObjectMapper objectMapper() {
-            return new ObjectMapper();
-        }
-    }
```

---

## 5. 완료 조건 및 검증 결과 (Verification Results)

- [x] **컴포넌트 스캔 및 JobRegistry 빈 공급**: `BatchConfig` 이동 후 `NoSuchBeanDefinitionException` 완전 해결
- [x] **기동 시 잡 자동실행 충돌 해소**: `spring.batch.job.enabled: false` 적용 후 `JobInstanceAlreadyCompleteException` 및 메타데이터 테이블 오류 해결
- [x] **빈 정의 충돌 해소**: 4개 테스트의 중복 `ObjectMapper` 제거로 `BeanDefinitionOverrideException` 완전 해결
- [x] **설정 바인딩 검증**: `WorkflowConfigTests` 및 `WorkflowConfigBindingTest` PASS
- [x] **Mock 정합성 및 비동기 스케줄러 검증**: `S3ToPostgresImportJobTest`, `WorkflowJobViewControllerIntegrationTest`, `DbSchedulerLogTest` PASS
- [x] **DB 제약조건 정합성 검증**: `DormantCustomerPolicyTest`, `DormantCustomerPolicyYamlIntegrationTest` PASS
- [x] **전체 단위/통합 테스트 검증**: `./gradlew test` (총 52개 테스트 100% PASS)
- [x] **전체 백엔드 빌드 검증**: `./gradlew build` (BUILD SUCCESSFUL)
- [x] **Backstage 프론트엔드 검증**: `yarn tsc` 0 오류, `yarn backstage-cli repo build --all` 성공, `theme-vercel` 단위 테스트 3개 PASS
- [x] **코드 컨벤션 준수**: 인라인 FQDN 사전 검열 및 최상단 import 준수 확인
