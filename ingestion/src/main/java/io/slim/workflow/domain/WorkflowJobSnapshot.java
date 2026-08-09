package io.slim.workflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.*;

public class WorkflowJobSnapshot {

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
