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

    private final WorkflowProperties workflowProps;
    private final SchedulerClient schedulerClient;
    private final RecurringTaskWithPersistentSchedule<WorkflowScheduleData> workflowJobTask;
    private final GitProperties gitInfo;

    @Override
    public void run(ApplicationArguments args) {
        syncAll(this.workflowProps);
    }

    public void syncAll(WorkflowProperties workflowProps) {
        if (workflowProps == null || workflowProps.jobs() == null) {
            return;
        }

        log.info("[BOOTSTRAP-SYNC] Starting synchronization for {} workflow jobs, version={}",
            workflowProps.jobs().size(), gitInfo.getCommitTime());

        for (WorkflowJob job : workflowProps.jobs().values()) {
            syncOne(job);
        }
        log.info("[BOOTSTRAP-SYNC] Synchronization complete");
    }

    private void syncOne(WorkflowJob job) {
        var taskInstanceId = TaskInstanceId.of(workflowJobTask.getTaskName(), job.jobName());
        var desiredSchedule = Schedules.cron(job.cron());
        var desiredData = WorkflowScheduleData.of(desiredSchedule, gitInfo, job);
        var desiredInstance = workflowJobTask.instance(job.jobName(), desiredData);

        var existingExecution = schedulerClient.getScheduledExecution(taskInstanceId);

        if (existingExecution.isEmpty()) {
            schedulerClient.schedule(desiredInstance,
                desiredSchedule.getInitialExecutionTime(Instant.now()));
            log.info("[BOOTSTRAP-CREATE] jobName={}", job.jobName());
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

        schedulerClient.reschedule(desiredInstance, desiredSchedule.getInitialExecutionTime(Instant.now()));
        log.info("[BOOTSTRAP-RESCHEDULE] Applied changes for jobName={}", job.jobName());
    }

}
