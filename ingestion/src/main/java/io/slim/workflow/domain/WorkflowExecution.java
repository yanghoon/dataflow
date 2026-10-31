package io.slim.workflow.domain;

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
