package io.slim.workflow.app.config.workflow;

import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

import io.slim.workflow.domain.WorkflowJob;

@ConfigurationProperties(prefix = "workflow")
public record WorkflowProperties(
        Map<String, WorkflowJob> jobs
    ) {

    public WorkflowProperties {
        if (jobs != null) {
            // 기존 맵을 순회하며 key를 jobName으로 주입한 새로운 객체들을 생성
            Map<String, WorkflowJob> enrichedJobs = new HashMap<>();
            jobs.forEach((key, job) -> {
                // WorkflowJob이 record라면 객체를 새로 복사(생성)해야 함
                WorkflowJob enrichedJob = new WorkflowJob(
                        key, // ★ 맵의 Key를 jobName으로 주입
                        job.group(),
                        job.cron(),
                        job.enabled(),
                        job.workflowType(),
                        job.props());
                enrichedJobs.put(key, enrichedJob);
            });
            // 파라미터 자체를 불변 맵으로 교체하여 최종 필드에 할당
            jobs = Map.copyOf(enrichedJobs);
        }
    }

}
