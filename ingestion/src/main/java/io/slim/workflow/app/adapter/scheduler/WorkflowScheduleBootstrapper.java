package io.slim.workflow.app.adapter.scheduler;

import java.time.Instant;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.info.GitProperties;

import com.github.kagkarlsson.scheduler.SchedulerClient;
import com.github.kagkarlsson.scheduler.task.TaskInstanceId;
import com.github.kagkarlsson.scheduler.task.helper.RecurringTaskWithPersistentSchedule;
import com.github.kagkarlsson.scheduler.task.schedule.Schedules;

import io.slim.workflow.app.config.workflow.WorkflowProperties;
import io.slim.workflow.domain.WorkflowJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
public class WorkflowScheduleBootstrapper implements ApplicationRunner {

    private final WorkflowProperties yamlJobs;
    private final SchedulerClient schedulerClient;
    private final RecurringTaskWithPersistentSchedule<WorkflowScheduleData> workflowJobTask;
    private final GitProperties gitInfo;

    @Override
    public void run(ApplicationArguments args) {
        syncAll(this.yamlJobs);
    }

    public void syncAll(WorkflowProperties targetYaml) {
        if (targetYaml == null || targetYaml.jobs() == null) return;
        
        log.info("[BOOTSTRAP-SYNC] WorkflowJob {}건 동기화 시작, myVersion={}",
            targetYaml.jobs().size(), gitInfo.getCommitTime());

        for (WorkflowJob job : targetYaml.jobs().values()) {
            syncOne(job);
        }
        log.info("[BOOTSTRAP-SYNC] 동기화 완료");
    }

    private void syncOne(WorkflowJob spec) {
        var id = TaskInstanceId.of("workflowjob", spec.jobName());
        var desiredSchedule = Schedules.cron(spec.cron());
        var desired = new WorkflowScheduleData(desiredSchedule, gitInfo != null ? gitInfo.getCommitTime() : null, spec);

        var taskInstance = workflowJobTask.instance(spec.jobName(), desired);

        var existing = schedulerClient.getScheduledExecution(id);

        if (existing.isEmpty()) {
            schedulerClient.schedule(taskInstance,
                desiredSchedule.getInitialExecutionTime(Instant.now()));
            log.info("[BOOTSTRAP-CREATE] jobName={}", spec.jobName());
            return;
        }

        // WorkflowScheduleData current = (WorkflowScheduleData) existing.get().getData();

        // // ① 버전 가드: 구버전(재시작/좀비 파드)이 신버전을 덮어쓰지 못하게
        // if (current.buildInfo().gitCommitTimeEpochMillis() >= myBuildInfo.gitCommitTimeEpochMillis()) {
        //     log.debug("[BOOTSTRAP-SKIP-STALE] jobName={}", spec.jobName());
        //     return;
        // }

        // // ② 내용 비교: 코드는 바뀌었어도 이 job 설정 자체는 안 바뀌었으면 write 생략
        // if (current.hasSameContentAs(desired)) {
        //     log.debug("[BOOTSTRAP-SKIP-NOCHANGE] jobName={}", spec.jobName());
        //     return;
        // }

        // // ③ 실행 중인 execution은 건드리지 않음
        // if (existing.get().isPicked()) {
        //     log.warn("[BOOTSTRAP-SKIP-PICKED] jobName={} 실행 중, 다음 기회로 연기", spec.jobName());
        //     return;
        // }

        schedulerClient.reschedule(taskInstance, desiredSchedule.getInitialExecutionTime(Instant.now()));
        log.info("[BOOTSTRAP-RESCHEDULE] jobName={} 변경 반영", spec.jobName());
    }

}
