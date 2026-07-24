
import lombok.Data;

public class ConnectionSpecs {

    @Data
    public class HttpConnectionSpec {
        private String baseUrl;
        private String authEnvVar;
    }

    @Data
    public class S3ConnectionSpec {
        private String endpoint;
        private String region;
    }

}