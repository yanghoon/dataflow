package io.slim.ingestion.batch.config;

import java.net.URI;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import io.slim.ingestion.batch.config.S3Config.S3Properties;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
@EnableConfigurationProperties(S3Properties.class)
public class S3Config {

    @Bean
    public S3Client s3Client(S3Properties props) {
        S3ClientBuilder builder = S3Client.builder()
            .region(Region.of(props.region()))
            .credentialsProvider(credentialsProvider(props))
            // .httpClientBuilder(httpClientBuilder(props))
            .serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(props.pathStyleAccess())
                .build());

        // airgap 온프레미스는 커스텀 엔드포인트 필수, AWS면 endpoint 미설정 시 기본값 사용
        if (StringUtils.hasText(props.endpoint())) {
            builder.endpointOverride(URI.create(props.endpoint()));
        }

        return builder.build();
    }

    private AwsCredentialsProvider credentialsProvider(S3Properties props) {
        if (StringUtils.hasText(props.accessKey()) && StringUtils.hasText(props.secretKey())) {
            return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(props.accessKey(), props.secretKey()));
        }
        return DefaultCredentialsProvider.create();
    }

    @ConfigurationProperties(prefix = "s3")
    public record S3Properties (
        String endpoint,
        String region,
        boolean pathStyleAccess,
        String accessKey,
        String secretKey
        // int connectionTimeoutMs = 5000;
        // int socketTimeoutMs = 30000;
        // int maxConnections = 50;
    ) {}
    
}
