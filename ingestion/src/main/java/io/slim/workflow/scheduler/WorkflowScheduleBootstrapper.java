package io.slim.workflow.scheduler;

import io.slim.workflow.config.WorkflowJobsYaml;
import io.slim.workflow.domain.WorkflowJobSpec;
import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;
import com.github.kagkarlsson.scheduler.task.schedule.Schedules;
import com.github.kagkarlsson.scheduler.task.schedule.Schedule;
import com.github.kagkarlsson.scheduler.ScheduledExecution;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.List;
import com.github.kagkarlsson.scheduler.task.helper.RecurringTaskWithPersistentSchedule;

@Component
public class WorkflowScheduleBootstrapper implements ApplicationRunner {
    private static final org.slf4j.Logger log =
        org.slf4j.LoggerFactory.getLogger(WorkflowScheduleBootstrapper.class);

    private final WorkflowJobsYaml yamlJobs;
    private final SchedulerClient schedulerClient;
    private final BuildInfo myBuildInfo; // git.commit.time 기반, 이 파드가 물고 있는 값
    private final List<RecurringTaskWithPersistentSchedule<WorkflowScheduleData>> tasks;

    public WorkflowScheduleBootstrapper(WorkflowJobsYaml yamlJobs,
                                        SchedulerClient schedulerClient,
                                        BuildInfo myBuildInfo,
                                        List<RecurringTaskWithPersistentSchedule<WorkflowScheduleData>> tasks) {
        this.yamlJobs = yamlJobs;
        this.schedulerClient = schedulerClient;
        this.myBuildInfo = myBuildInfo;
        this.tasks = tasks;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (yamlJobs.jobs() == null) return;
        
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

        var task = tasks.stream().filter(t -> t.getName().equals(spec.group())).findFirst().orElseThrow();
        var taskInstance = task.instance(spec.jobName(), desired);

        Optional<ScheduledExecution<Object>> existing =
            schedulerClient.getScheduledExecution(id);

        if (existing.isEmpty()) {
            schedulerClient.schedule(taskInstance,
                desiredSchedule.getInitialExecutionTime(Instant.now()));
            log.info("[BOOTSTRAP-CREATE] jobName={}", spec.jobName());
            return;
        }

        WorkflowScheduleData current = (WorkflowScheduleData) existing.get().getData();

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

        schedulerClient.reschedule(taskInstance, desiredSchedule.getInitialExecutionTime(Instant.now()));
        log.info("[BOOTSTRAP-RESCHEDULE] jobName={} 변경 반영", spec.jobName());
    }
}
