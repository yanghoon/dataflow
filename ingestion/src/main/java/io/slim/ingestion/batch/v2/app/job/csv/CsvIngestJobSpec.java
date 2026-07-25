package io.slim.ingestion.batch.v2.app.job.csv;

import java.util.List;

public record CsvIngestJobSpec(
    String name,
    String source,
    String token,
    Integer retryCount,
    Long retryInterval,
    S3Spec s3,
    PostgresSpec postgres
) {

    public record S3Spec(
        String endpoint,
        String bucket,
        String accessKey,
        String secretKey,
        Boolean pathStyleAccess,
        String region
    ) {}

    public record PostgresSpec(
        CopySpec copy,
        String insertSql
    ) {}

    public record CopySpec(
        String tableName,
        String format,
        Boolean header,
        List<String> columns
    ) {}
}
