package io.slim.ingestion.batch.job.step.s3;

public class TargetConfig {
    
    String bucket;
    String key;
    int partSizeBytes = 8 * 1024 * 1024;
    // String region = "us-east-1";
    // boolean pathStyleAccess = true;

    public String getBucket() { return bucket; }
    public String getKey() { return key; }
    public int getPartSizeBytes() { return partSizeBytes; }

    public void setBucket(String bucket) { this.bucket = bucket; }
    public void setKey(String key) { this.key = key; }
    public void setPartSizeBytes(int partSizeBytes) { this.partSizeBytes = partSizeBytes; }

}
