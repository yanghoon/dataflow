package io.slim.ingestion.batch.v2.app.job.csv;

public record CsvIngestJobSpec(
    String name,
    String source,
    String token,
    Long retryInterval,
    S3Spec s3,
    // String s3Endpoint,
    // String s3Bucket,
    // String s3AccessKey,
    // String s3SecretKey,
    // Boolean s3PathStyleAccess,
    // String s3Region
    String targetTable,
    String copySql,
    String insertSql
) {

    public record S3Spec(
        String endpoint,
        String bucket,
        String accessKey,
        String secretKey,
        Boolean pathStyleAccess,
        String region
    ) {}

}
