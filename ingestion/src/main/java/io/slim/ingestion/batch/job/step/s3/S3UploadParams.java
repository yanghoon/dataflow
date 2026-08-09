
public class S3UploadParams {
    SourceParams source;
    TargetParams target;

    public class SourceParams {
        String type;
        HttpCallParams http;
    }

    public class TargetParams {
        String connectionId;
        String bucket;
        String keyPrefix;
        int partSizeBytes;
    }

}