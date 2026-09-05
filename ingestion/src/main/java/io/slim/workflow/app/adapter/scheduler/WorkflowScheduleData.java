package io.slim.workflow.app.adapter.scheduler;

import java.io.Serializable;
import java.time.Instant;
import java.util.Optional;

import org.springframework.boot.info.GitProperties;

import com.github.kagkarlsson.scheduler.task.helper.ScheduleAndData;
import com.github.kagkarlsson.scheduler.task.schedule.Schedule;

import io.slim.workflow.domain.WorkflowJob;

public record WorkflowScheduleData(
    Schedule schedule, // Cached schedule derived from the job cron expression.
    GitProps gitProps, // Git metadata excluded from content comparisons.
    WorkflowJob content // Job configuration used for execution and display.
) implements ScheduleAndData {
    public WorkflowScheduleData {
        gitProps = Optional.ofNullable(gitProps).orElse(GitProps.EMPTY);
    }

    public static WorkflowScheduleData of(Schedule schedule, GitProperties gitProperties, WorkflowJob content) {
        return new WorkflowScheduleData(schedule, GitProps.of(gitProperties), content);
    }

    @Override public Schedule getSchedule() { return schedule; }
    @Override public Object getData() { return null; }

    public boolean hasSameContentAs(WorkflowScheduleData other) {
        return content.equals(other.content); // Git metadata is intentionally ignored.
    }

    public record GitProps(
        String branch,
        String commitId,
        Instant commitTime,
        String shortCommitId
    ) implements Serializable {

        public static GitProps EMPTY = new GitProps(null, null, null, null);

        public static GitProps of(GitProperties gitProperties) {
            if (gitProperties == null) return EMPTY;;

            return new GitProps(
                gitProperties.getBranch(),
                gitProperties.getCommitId(),
                gitProperties.getCommitTime(),
                gitProperties.getShortCommitId()
            );
        }

    }

}
