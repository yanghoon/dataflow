package io.slim.workflow.app.adapter.scheduler;

public record BuildInfo(
    long gitCommitTimeEpochMillis, // version guard 비교 근거 — 같은 커밋이면 항상 동일값
    String gitCommitIdAbbrev,      // 디버깅 추적용
    String appVersion              // 사람이 읽는 표시용
) {
    public static BuildInfo current(org.springframework.boot.info.GitProperties gitProperties,
                                    org.springframework.boot.info.BuildProperties buildProperties) {
        return new BuildInfo(
            gitProperties.getCommitTime().toEpochMilli(),
            gitProperties.getShortCommitId(),
            buildProperties.getVersion()
        );
    }
}
