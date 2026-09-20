package io.slim.ingestion.batch.v2.app.job.async;

public record DormantUser(Long id, String email, String lastLoginDate) {}
