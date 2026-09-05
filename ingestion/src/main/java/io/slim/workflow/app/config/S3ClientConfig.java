package io.slim.workflow.app.config;

import java.net.URI;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import io.slim.workflow.app.config.S3ClientConfig.S3Properties;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
@EnableConfigurationProperties(S3Properties.class)
@RequiredArgsConstructor
public class S3ClientConfig {

    // private final Environment env;
    private final S3Properties props;

    @Bean
    Map<String, S3Client> s3Clients() {
        if (props.s3() == null) {
            return java.util.Collections.emptyMap();
        }
        return props.s3().entrySet().stream()
                    .collect(Collectors.toMap(
                        e -> e.getKey(),
                        e -> create(e.getValue())
                    ));
    }

    private S3Client create(S3ClientSpec spec) {
        var builder = S3Client.builder()
            .region(Region.of(spec.region))
            .credentialsProvider(credentialProvider(spec))
            .httpClientBuilder(ApacheHttpClient.builder())
            .serviceConfiguration(config -> config
                .pathStyleAccessEnabled(spec.pathStytleAccess)
                .checksumValidationEnabled(false)
            );
        
        if (StringUtils.hasText(spec.endpoint)) {
            builder.endpointOverride(URI.create(spec.endpoint));
        }

        return builder.build();
    }

    private AwsCredentialsProvider credentialProvider(S3ClientSpec spec) {
        if (StringUtils.hasText(spec.accessKey) && StringUtils.hasText(spec.secretKey)) {
            return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(spec.accessKey, spec.secretKey)
            );
        }
        return DefaultCredentialsProvider.builder().build();
    }
    

    @ConfigurationProperties("app")
    public record S3Properties(Map<String, S3ClientSpec> s3) {}

    public record S3ClientSpec (
        String endpoint,
        String region,
        String accessKey,
        String secretKey,
        boolean pathStytleAccess
    ) {
        public S3ClientSpec {
            region = Optional.ofNullable(region).orElse(Region.US_EAST_1.toString());
        }
    }

}
