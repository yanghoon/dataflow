package io.slim.workflow.domain.utils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.slim.workflow.domain.WorkflowJob;
import io.slim.workflow.domain.WorkflowParams;
import lombok.Data;

class WorkflowPropsBinderTest {

    @Data
    static class TestContext {
        private String targetTable;
        private String targetDate;
        private int limit;
    }

    @Test
    @DisplayName("job.props와 params가 병합되며, params가 우선순위를 가진다")
    void testBindMerged() {
        // given
        var props = Map.of(
            "targetTable", "default_table",
            "targetDate", "2023-01-01",
            "limit", "10"
        );
        var job = new WorkflowJob("test-job", "group", "0 0 0 * * ?", true, "type", props, null);
        
        var overrideValues = Map.of(
            "targetDate", "2023-12-31", // override
            "limit", "100" // override
        );
        var params = new WorkflowParams(overrideValues);

        // when
        var result = WorkflowPropsBinder.bind(job, params, TestContext.class);

        // then
        assertThat(result.getTargetTable()).isEqualTo("default_table"); // from job.props
        assertThat(result.getTargetDate()).isEqualTo("2023-12-31"); // overridden by params
        assertThat(result.getLimit()).isEqualTo(100); // overridden and type casted
    }

    @Test
    @DisplayName("params가 비어있어도 job.props로 정상 바인딩된다")
    void testBindWithoutParams() {
        // given
        var props = Map.of(
            "targetTable", "default_table",
            "targetDate", "2023-01-01",
            "limit", "10"
        );
        var job = new WorkflowJob("test-job", "group", "0 0 0 * * ?", true, "type", props, null);
        var params = WorkflowParams.empty();

        // when
        var result = WorkflowPropsBinder.bind(job, params, TestContext.class);

        // then
        assertThat(result.getTargetTable()).isEqualTo("default_table");
        assertThat(result.getTargetDate()).isEqualTo("2023-01-01");
        assertThat(result.getLimit()).isEqualTo(10);
    }
}
