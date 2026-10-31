지금까지 확정된 설계를 기준으로 전체 소스코드를 정리합니다. 여러 번 수정된 설계는 최종 합의안만 반영했습니다 (예: Task=비즈니스앱 그룹 단위, content는 HttpHeaders 스타일 클래스, configVersion은 git.commit.time 기반).

// ============================================================

// domain/Workflow.java — 공통 처리 로직 인터페이스

// ============================================================

package com.company.workflow.domain;

public interface Workflow {

/**

* 이 로직의 private method 하나하나가 향후 Spring Batch Step에 대응.

* where 설정과 실행시점 params를 받아 Source→Sink 처리를 수행.

*/

WorkflowExecutionResult execute(WorkflowJobSnapshot jobSnapshot, WorkflowParams params);

}

// ============================================================

// domain/WorkflowParams.java — 트리거 시점에만 결정되는 값

// ============================================================

package com.company.workflow.domain;

import java.util.Map;

public record WorkflowParams(Map<String, String> values) {

public static WorkflowParams empty() {

return new WorkflowParams(Map.of());

}

public String get(String key) {

return values.get(key);

}

}

// ============================================================

// domain/WorkflowExecution.java — 1회 실행 결과, 단방향 이력 로그

// ============================================================

package com.company.workflow.domain;

import java.time.Instant;

public record WorkflowExecution(

Long id,

String jobName,

String status,          // SUCCESS | FAILED | SKIPPED

Instant startedAt,

Instant finishedAt,

String errorMessage,

String usedParamsJson,  // 실행 시점 WorkflowParams 스냅샷 (감사용)

String gitCommitIdAbbrev

) {}

public record WorkflowExecutionResult(boolean success, String errorMessage) {}

// ============================================================

// domain/WorkflowJobSnapshot.java — HttpHeaders 스타일 확장 가능 스냅샷

// ============================================================

package com.company.workflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

import com.fasterxml.jackson.annotation.JsonValue;

import java.util.*;

public class WorkflowJobSnapshot {

// 잘 알려진 키 — HttpHeaders.CONTENT_TYPE과 동일한 의도

public static final String JOB_NAME = "jobName";

public static final String GROUP = "group";               // 비즈니스 앱 그룹 (task_name)

public static final String CRON_EXPRESSION = "cronExpression";

public static final String ENABLED = "enabled";

public static final String ENGINE = "engine";              // WORKFLOW | SPRING_BATCH

public static final String WORKFLOW_TYPE = "workflowType";

public static final String SPRING_BATCH_JOB_NAME = "springBatchJobName";

public static final String WHERE = "where";

private final Map<String, Object> raw;

@JsonCreator

public WorkflowJobSnapshot(Map<String, Object> raw) {

this.raw = new LinkedHashMap<>(raw);

}

public WorkflowJobSnapshot() {

this(new LinkedHashMap<>());

}

public String jobName() { return (String) raw.get(JOB_NAME); }

public WorkflowJobSnapshot jobName(String v) { raw.put(JOB_NAME, v); return this; }

public String group() { return (String) raw.get(GROUP); }

public WorkflowJobSnapshot group(String v) { raw.put(GROUP, v); return this; }

public String cronExpression() { return (String) raw.get(CRON_EXPRESSION); }

public WorkflowJobSnapshot cronExpression(String v) { raw.put(CRON_EXPRESSION, v); return this; }

public boolean enabled() { return (boolean) raw.getOrDefault(ENABLED, false); }

public WorkflowJobSnapshot enabled(boolean v) { raw.put(ENABLED, v); return this; }

public Engine engine() { return Engine.valueOf((String) raw.getOrDefault(ENGINE, "WORKFLOW")); }

public WorkflowJobSnapshot engine(Engine v) { raw.put(ENGINE, v.name()); return this; }

public String workflowType() { return (String) raw.get(WORKFLOW_TYPE); }

public WorkflowJobSnapshot workflowType(String v) { raw.put(WORKFLOW_TYPE, v); return this; }

public String springBatchJobName() { return (String) raw.get(SPRING_BATCH_JOB_NAME); }

public WorkflowJobSnapshot springBatchJobName(String v) { raw.put(SPRING_BATCH_JOB_NAME, v); return this; }

@SuppressWarnings("unchecked")

public Map<String, String> where() {

return (Map<String, String>) raw.getOrDefault(WHERE, Map.of());

}

public WorkflowJobSnapshot where(Map<String, String> v) { raw.put(WHERE, v); return this; }

// 범용 탈출구 — 아직 전용 메서드가 없는 신규 필드도 즉시 사용 가능

public Object get(String key) { return raw.get(key); }

public WorkflowJobSnapshot set(String key, Object value) { raw.put(key, value); return this; }

@JsonValue

public Map<String, Object> asMap() {

return Collections.unmodifiableMap(raw);

}

public static WorkflowJobSnapshot immutable(WorkflowJobSnapshot source) {

return new WorkflowJobSnapshot(Collections.unmodifiableMap(source.raw));

}

@Override

public boolean equals(Object o) {

return o instanceof WorkflowJobSnapshot other && this.raw.equals(other.raw);

}

@Override

public int hashCode() { return raw.hashCode(); }

public enum Engine { WORKFLOW, SPRING_BATCH }

}

// ============================================================

// domain/WorkflowJobSpec.java — YAML 바인딩 원본

// ============================================================

package com.company.workflow.domain;

import java.util.Map;

public record WorkflowJobSpec(

String jobName,

String group,

WorkflowJobSnapshot.Engine engine,

String cronExpression,

boolean enabled,

String workflowType,

String springBatchJobName,

Map<String, String> where

) {

public WorkflowJobSnapshot toSnapshot() {

return new WorkflowJobSnapshot()

.jobName(jobName).group(group).cronExpression(cronExpression)

.enabled(enabled).engine(engine).workflowType(workflowType)

.springBatchJobName(springBatchJobName).where(where);

}

}

// ============================================================

// config/WorkflowJobsYaml.java — YAML 원본 소스

// ============================================================

package com.company.workflow.config;

import com.company.workflow.domain.WorkflowJobSpec;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

@ConfigurationProperties(prefix = "workflow")

public record WorkflowJobsYaml(Map<String, WorkflowJobSpec> jobs) {}

# application.yml — workflow.jobs 섹션 예시

workflow:

jobs:

daily-sales-ingest:

jobName: daily-sales-ingest

group: sales-app

engine: WORKFLOW

workflowType: HttpIngestWorkflow

cronExpression: "0 0 * * * *"

enabled: true

where:

endpoint: "https://internal-api/sales"

credentialRef: "http-source-sales"   # 자격증명은 참조 키만

full-catalog-sync:

jobName: full-catalog-sync

group: inventory-app

engine: SPRING_BATCH

springBatchJobName: catalogPagingJob

cronExpression: "0 0 2 * * *"

enabled: true

where:

endpoint: "https://internal-api/catalog"

pageSize: "500"

targetTable: "catalog_raw"

// ============================================================

// scheduler/WorkflowScheduleData.java — TaskInstance 페이로드

// ============================================================

package com.company.workflow.scheduler;

import com.company.workflow.domain.WorkflowJobSnapshot;

import com.github.kagkarlsson.scheduler.task.schedule.Schedule;

import com.github.kagkarlsson.scheduler.task.schedule.ScheduleAndData;

public record WorkflowScheduleData(

Schedule schedule,       // 인터페이스 계약 — content.cronExpression()의 파생 캐시

BuildInfo buildInfo,     // 비교에서 반드시 제외, git.commit.time 기반 version guard

WorkflowJobSnapshot content // 그 외 전부 — 비교/실행판단/UI노출/감사로그 겸용

) implements ScheduleAndData {

@Override public Schedule getSchedule() { return schedule; }

@Override public Object getData() { return null; } // 전체 객체가 어차피 통째로 직렬화됨

public boolean hasSameContentAs(WorkflowScheduleData other) {

return this.content.equals(other.content); // buildInfo는 비교 범위 밖

}

}

// ============================================================

// scheduler/BuildInfo.java — git.commit.time 기반 (ADR 확정본)

// ============================================================

package com.company.workflow.scheduler;

public record BuildInfo(

long gitCommitTimeEpochMillis, // version guard 비교 근거 — 같은 커밋이면 항상 동일값

String gitCommitIdAbbrev,      // 디버깅 추적용

String appVersion              // 사람이 읽는 표시용

) {

public static BuildInfo current(org.springframework.boot.info.GitProperties gitProperties,

org.springframework.boot.info.BuildProperties buildProperties) {

return new BuildInfo(

gitProperties.getCommitTime().toEpochMilli(),

gitProperties.getShortCommitId(),

buildProperties.getVersion()

);

}

}

// ============================================================

// scheduler/WorkflowSchedulerConfig.java — Task 등록 (그룹 단위)

// ============================================================

package com.company.workflow.scheduler;

import com.github.kagkarlsson.scheduler.Scheduler;

import com.github.kagkarlsson.scheduler.task.helper.RecurringTaskWithPersistentSchedule;

import com.github.kagkarlsson.scheduler.task.helper.Tasks;

import com.github.kagkarlsson.scheduler.task.FailureHandler;

import org.springframework.context.annotation.*;

import javax.sql.DataSource;

import java.time.Duration;

import java.util.*;

@Configuration

public class WorkflowSchedulerConfig {

private static final org.slf4j.Logger log =

org.slf4j.LoggerFactory.getLogger(WorkflowSchedulerConfig.class);

/**

* 비즈니스 앱(그룹) 단위로 Task를 생성.

* 근거: 실패의 지역성이 앱 단위로 귀속되므로(외부 API 오류 등),

* 모니터링/관측을 앱 단위로 그룹핑하는 게 실무적으로 더 유용함.

* (Workflow 타입 단위 분리는 재검토 끝에 기각됨 — 재사용 로직 자체엔 격리가 불필요)

*/

@Bean

public List<RecurringTaskWithPersistentSchedule<WorkflowScheduleData>> workflowGroupTasks(

WorkflowTriggerExecutor executor,

List<String> configuredGroups /* YAML의 group 값들의 distinct set, 별도 빈으로 주입 */) {

List<RecurringTaskWithPersistentSchedule<WorkflowScheduleData>> tasks = new ArrayList<>();

for (String group : configuredGroups) {

tasks.add(createGroupTask(group, executor));

}

return tasks;

}

private RecurringTaskWithPersistentSchedule<WorkflowScheduleData> createGroupTask(

String group, WorkflowTriggerExecutor executor) {

log.info("[TASK-REGISTER] Task '{}' 정의 생성", group);

return Tasks.recurringWithPersistentSchedule(group, WorkflowScheduleData.class)

.onFailure(new FailureHandler.MaxRetriesFailureHandler<>(3,

new FailureHandler.ExponentialBackoffFailureHandler<>(Duration.ofSeconds(30), 2)))

.execute((taskInstance, ctx) -> {

log.info("[TASK-EXECUTE] group={} jobName={} 실행 시작", group, taskInstance.getId());

WorkflowScheduleData result = executor.run(taskInstance.getId(), taskInstance.getData());

log.info("[TASK-EXECUTE] group={} jobName={} 실행 종료", group, taskInstance.getId());

return result;

});

}

@Bean

public Scheduler scheduler(

DataSource dataSource,

List<RecurringTaskWithPersistentSchedule<WorkflowScheduleData>> tasks) {

log.info("[SCHEDULER-INIT] db-scheduler 엔진 기동, Task 개수={}", tasks.size());

return Scheduler.create(dataSource, tasks)

.threads(10)

.build();

}

}

// ============================================================

// scheduler/WorkflowTriggerExecutor.java — engine별 실행 분기

// ============================================================

package com.company.workflow.scheduler;

import com.company.workflow.domain.*;

import com.company.workflow.launcher.WorkflowLauncher;

import org.springframework.batch.core.Job;

import org.springframework.batch.core.JobParameters;

import org.springframework.batch.core.JobParametersBuilder;

import org.springframework.batch.core.configuration.JobRegistry;

import org.springframework.batch.core.launch.JobOperator;

import org.springframework.stereotype.Component;

@Component

public class WorkflowTriggerExecutor {

private static final org.slf4j.Logger log =

org.slf4j.LoggerFactory.getLogger(WorkflowTriggerExecutor.class);

private final WorkflowLauncher workflowLauncher;

private final JobOperator jobOperator;      // Spring Batch 6: JobLauncher 겸용

private final JobRegistry jobRegistry;       // v6: 컨텍스트에서 자동 등록됨

public WorkflowTriggerExecutor(WorkflowLauncher workflowLauncher,

JobOperator jobOperator,

JobRegistry jobRegistry) {

this.workflowLauncher = workflowLauncher;

this.jobOperator = jobOperator;

this.jobRegistry = jobRegistry;

}

public WorkflowScheduleData run(String jobName, WorkflowScheduleData data) {

WorkflowJobSnapshot snapshot = data.content();

if (!snapshot.enabled()) {

log.info("[EXEC-SKIP] jobName={} enabled=false", jobName);

return data;

}

switch (snapshot.engine()) {

case WORKFLOW -> workflowLauncher.launch(snapshot, WorkflowParams.empty());

case SPRING_BATCH -> {

try {

Job job = jobRegistry.getJob(snapshot.springBatchJobName());

jobOperator.start(job, buildJobParameters(snapshot));

} catch (Exception e) {

log.error("[EXEC-BATCH-FAIL] jobName={}", jobName, e);

throw new WorkflowExecutionException(jobName, e);

}

}

}

return data;

}

private JobParameters buildJobParameters(WorkflowJobSnapshot snapshot) {

var builder = new JobParametersBuilder()

.addString("endpoint", snapshot.where().get("endpoint"))

.addString("targetTable", snapshot.where().get("targetTable"))

.addLong("triggerTime", System.currentTimeMillis()); // 매번 새 JobInstance 강제

if (snapshot.where().containsKey("pageSize")) {

builder.addLong("pageSize", Long.parseLong(snapshot.where().get("pageSize")));

}

return builder.toJobParameters();

}

}

class WorkflowExecutionException extends RuntimeException {

WorkflowExecutionException(String jobName, Throwable cause) {

super("워크플로우 실행 실패: " + jobName, cause);

}

}

// ============================================================

// scheduler/WorkflowScheduleBootstrapper.java — 기동 시 동기화

// ============================================================

package com.company.workflow.scheduler;

import com.company.workflow.config.WorkflowJobsYaml;

import com.company.workflow.domain.WorkflowJobSpec;

import com.github.kagkarlsson.scheduler.SchedulerClient;

import com.github.kagkarlsson.scheduler.task.TaskInstanceId;

import com.github.kagkarlsson.scheduler.task.helper.Schedules;

import com.github.kagkarlsson.scheduler.task.schedule.Schedule;

import com.github.kagkarlsson.scheduler.task.ScheduledExecution;

import org.springframework.boot.ApplicationArguments;

import org.springframework.boot.ApplicationRunner;

import org.springframework.stereotype.Component;

import java.time.Instant;

import java.util.Optional;

@Component

public class WorkflowScheduleBootstrapper implements ApplicationRunner {

private static final org.slf4j.Logger log =

org.slf4j.LoggerFactory.getLogger(WorkflowScheduleBootstrapper.class);

private final WorkflowJobsYaml yamlJobs;

private final SchedulerClient schedulerClient;

private final BuildInfo myBuildInfo; // git.commit.time 기반, 이 파드가 물고 있는 값

public WorkflowScheduleBootstrapper(WorkflowJobsYaml yamlJobs,

SchedulerClient schedulerClient,

BuildInfo myBuildInfo) {

this.yamlJobs = yamlJobs;

this.schedulerClient = schedulerClient;

this.myBuildInfo = myBuildInfo;

}

@Override

public void run(ApplicationArguments args) {

log.info("[BOOTSTRAP-START] WorkflowJob {}건 동기화 시작, myVersion={}",

yamlJobs.jobs().size(), myBuildInfo.gitCommitTimeEpochMillis());

for (WorkflowJobSpec spec : yamlJobs.jobs().values()) {

syncOne(spec);

}

log.info("[BOOTSTRAP-END] 동기화 완료");

}

private void syncOne(WorkflowJobSpec spec) {

TaskInstanceId id = TaskInstanceId.of(spec.group(), spec.jobName());

Schedule desiredSchedule = Schedules.cron(spec.cronExpression());

WorkflowScheduleData desired = new WorkflowScheduleData(desiredSchedule, myBuildInfo, spec.toSnapshot());

Optional<ScheduledExecution<WorkflowScheduleData>> existing =

schedulerClient.getScheduledExecution(id);

if (existing.isEmpty()) {

schedulerClient.scheduleIfNotExists(id,

desiredSchedule.getInitialExecutionTime(Instant.now()), desired);

log.info("[BOOTSTRAP-CREATE] jobName={}", spec.jobName());

return;

}

WorkflowScheduleData current = existing.get().getData();

// ① 버전 가드: 구버전(재시작/좀비 파드)이 신버전을 덮어쓰지 못하게

if (current.buildInfo().gitCommitTimeEpochMillis() >= myBuildInfo.gitCommitTimeEpochMillis()) {

log.debug("[BOOTSTRAP-SKIP-STALE] jobName={}", spec.jobName());

return;

}

// ② 내용 비교: 코드는 바뀌었어도 이 job 설정 자체는 안 바뀌었으면 write 생략

if (current.hasSameContentAs(desired)) {

log.debug("[BOOTSTRAP-SKIP-NOCHANGE] jobName={}", spec.jobName());

return;

}

// ③ 실행 중인 execution은 건드리지 않음

if (existing.get().isPicked()) {

log.warn("[BOOTSTRAP-SKIP-PICKED] jobName={} 실행 중, 다음 기회로 연기", spec.jobName());

return;

}

schedulerClient.reschedule(id, desiredSchedule.getInitialExecutionTime(Instant.now()), desired);

log.info("[BOOTSTRAP-RESCHEDULE] jobName={} 변경 반영", spec.jobName());

}

}

// ============================================================

// launcher/WorkflowLauncher.java — jobName 조회 + 로직 결합 실행

// ============================================================

package com.company.workflow.launcher;

import com.company.workflow.domain.*;

import java.time.Instant;

import java.util.Map;

public interface WorkflowLauncher {

WorkflowExecution launch(WorkflowJobSnapshot snapshot, WorkflowParams params);

}

@org.springframework.stereotype.Component

class WorkflowLauncherImpl implements WorkflowLauncher {

private final Map<String, Workflow> workflowsByType; // workflowType -> Bean, Spring이 주입

private final WorkflowExecutionRepository execRepo;

WorkflowLauncherImpl(Map<String, Workflow> workflowsByType, WorkflowExecutionRepository execRepo) {

this.workflowsByType = workflowsByType;

this.execRepo = execRepo;

}

@Override

public WorkflowExecution launch(WorkflowJobSnapshot snapshot, WorkflowParams params) {

Instant start = Instant.now();

Workflow workflow = workflowsByType.get(snapshot.workflowType());

if (workflow == null) {

throw new IllegalStateException("알 수 없는 workflowType: " + snapshot.workflowType());

}

WorkflowExecutionResult result;

try {

result = workflow.execute(snapshot, params);

} catch (Exception e) {

result = new WorkflowExecutionResult(false, e.getMessage());

}

WorkflowExecution execution = new WorkflowExecution(

null, snapshot.jobName(),

result.success() ? "SUCCESS" : "FAILED",

start, Instant.now(), result.errorMessage(),

params.toString(), null

);

return execRepo.save(execution);

}

}

interface WorkflowExecutionRepository {

WorkflowExecution save(WorkflowExecution execution);

}

// ============================================================

// batch/CatalogBatchConfig.java — Spring Batch 6, Step 생략

// ============================================================

package com.company.workflow.batch;

import org.springframework.batch.core.Job;

import org.springframework.batch.core.job.builder.JobBuilder;

import org.springframework.batch.core.repository.JobRepository;

import org.springframework.batch.core.configuration.annotation.EnableJdbcJobRepository;

import org.springframework.context.annotation.*;

@Configuration

@EnableJdbcJobRepository

public class CatalogBatchConfig {

@Bean

public Job catalogPagingJob(JobRepository jobRepository) {

return new JobBuilder("catalogPagingJob", jobRepository)

// .start(fetchPageStep).next(...)  ← Step 구현은 범위 밖

.build();

}

}

// ============================================================

// admin/WorkflowJobViewController.java — 디버깅/조회용 admin API

// ============================================================

package com.company.workflow.admin;

import com.company.workflow.config.WorkflowJobsYaml;

import com.company.workflow.domain.WorkflowJobSpec;

import com.github.kagkarlsson.scheduler.SchedulerClient;

import com.github.kagkarlsson.scheduler.task.TaskInstanceId;

import org.springframework.web.bind.annotation.*;

import java.time.Instant;

import java.util.*;

@RestController

@RequestMapping("/admin/workflow-jobs")

public class WorkflowJobViewController {

private final WorkflowJobsYaml yamlJobs;

private final SchedulerClient schedulerClient;

public WorkflowJobViewController(WorkflowJobsYaml yamlJobs, SchedulerClient schedulerClient) {

this.yamlJobs = yamlJobs;

this.schedulerClient = schedulerClient;

}

@GetMapping

public List<WorkflowJobView> listAll() {

List<WorkflowJobView> views = new ArrayList<>();

for (WorkflowJobSpec spec : yamlJobs.jobs().values()) {

TaskInstanceId id = TaskInstanceId.of(spec.group(), spec.jobName());

var scheduled = schedulerClient.getScheduledExecution(id);

views.add(new WorkflowJobView(

spec.jobName(), spec.group(), spec.workflowType(), spec.cronExpression(),

spec.enabled(),

scheduled.map(e -> e.getExecutionTime()).orElse(null),

scheduled.map(e -> e.isPicked()).orElse(false)

));

}

return views;

}

}

record WorkflowJobView(

String jobName, String group, String workflowType, String cronExpression,

boolean enabled, Instant nextExecutionTime, boolean running

) {}

// ============================================================

// build.gradle.kts (루트) — git.commit.time 기반 버전 (ADR 확정본)

// ============================================================

import com.gorylenko.GitPropertiesPluginExtension

plugins {

id("com.gorylenko.gradle-git-properties") version "4.0.1" apply false

}

subprojects {

plugins.withId("com.gorylenko.gradle-git-properties") {

configure<GitPropertiesPluginExtension> {

// Jib 캐시 보호: git.properties 파일 내용의 휘발성 값을 고정 문자열로 차단

// (이미지 생성시각 때문이 아니라, 이 파일 바이트 자체가 매번 달라져 레이어 캐시가 깨지는 걸 방지)

customProperty("git.build.time", "none")

customProperty("git.build.host", "none")

customProperty("git.build.user.name", "none")

customProperty("git.build.user.email", "none")

keys = listOf("git.branch", "git.commit.id.abbrev", "git.commit.time")

dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"

dateFormatTimeZone = "UTC"

}

}

}

<!-- Jib base image — 에어갭 환경, SHA digest 고정 -->

<container>

<from>

<image>internal-registry.corp/base/temurin-jre:21@sha256:...</image>

</from>

</container>

설계상 명시적으로 생략/보류된 부분: Workflow 구현체별 private method(Step 대응) 상세 로직, Spring Batch Step 구현(요청에 따라 제외), DB 모드 WorkflowJobAdminService(최종적으로 YAML+버전가드 방식으로 수렴), CI(GitHub Actions/Skaffold) 워크플로우 파일 — 이건 앞서 텍스트로 확정했으나 이번 코드 집계 범위에는 애플리케이션 소스만 포함했습니다. 필요하시면 이어서 정리해드릴 수 있습니다.