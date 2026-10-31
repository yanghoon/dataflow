package io.slim.workflow.scheduler;

import io.slim.workflow.domain.WorkflowJobSnapshot;
import com.github.kagkarlsson.scheduler.task.schedule.Schedule;
import com.github.kagkarlsson.scheduler.task.helper.ScheduleAndData;

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
