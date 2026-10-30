package io.slim.workflow.app.config.workflow;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.boot.context.properties.ConfigurationProperties;

import io.slim.workflow.domain.WorkflowJob;

@ConfigurationProperties(prefix = "workflow")
public record WorkflowProperties(
        Map<String, WorkflowJob> jobs
    ) {

    public WorkflowProperties {
        if (jobs != null) {
            // 파라미터 자체를 불변 맵으로 교체하여 최종 필드에 할당
            jobs = jobs.entrySet().stream()
                .collect(Collectors.toUnmodifiableMap(
                    Map.Entry::getKey,
                    e -> e.getValue().withName(e.getKey())
                ));
        }
    }

}
