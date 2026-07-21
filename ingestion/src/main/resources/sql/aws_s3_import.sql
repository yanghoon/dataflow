SELECT aws_s3.table_import_from_s3(
    :tableName,
    :columns,
    :importOptions,
    aws_commons.create_s3_uri(:s3Bucket, :s3Key, :s3Region)
);
