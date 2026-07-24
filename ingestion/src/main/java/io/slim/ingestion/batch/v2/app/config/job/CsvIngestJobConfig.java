package io.slim.ingestion.batch.v2.app.config.job;

import java.net.URI;
import java.util.List;

import javax.sql.DataSource;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.client.RestClient;

import io.slim.ingestion.batch.v2.app.config.job.CsvIngestJobConfig.CsvIngestJobProps;
import io.slim.ingestion.batch.v2.app.job.csv.CsvIngestJob;
import io.slim.ingestion.batch.v2.app.job.csv.CsvIngestJobSpec;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
@EnableConfigurationProperties(CsvIngestJobProps.class)
@RequiredArgsConstructor
public class CsvIngestJobConfig {

    private final CsvIngestJobProps props;
    private final GenericApplicationContext context;
    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;
    
    @ConfigurationProperties("jobs")
    public record CsvIngestJobProps(
        List<CsvIngestJobSpec> csv
    ) {}


    @PostConstruct
    public void registerJobs() {
        if (props.csv() == null) {
            return;
        }

        for (CsvIngestJobSpec spec : props.csv()) {
            context.registerBean(spec.name(), Job.class, () -> {
                var restClient = restClient(spec);
                var s3Client = s3Client(spec);

                var job = new CsvIngestJob(spec, restClient, s3Client, jobRepository, transactionManager, dataSource);
                return job.buildJob();
            });
        }
    }

    private RestClient restClient(CsvIngestJobSpec spec) {
        var builder= RestClient.builder().baseUrl(spec.source());

        if (spec.token() != null && !"none".equalsIgnoreCase(spec.token())) {
            builder.defaultHeaders(h -> h.setBearerAuth(spec.token()));
            // restClientBuilder.defaultHeaders(h -> h.setBasicAuth("", spec.token()));
        }

        return builder.build();
    }

    private S3Client s3Client(CsvIngestJobSpec spec) {
        return S3Client.builder()
                .endpointOverride(URI.create(spec.s3().endpoint()))
                .region(Region.of(spec.s3().region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(spec.s3().accessKey(), spec.s3().secretKey())
                ))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(spec.s3().pathStyleAccess())
                        .build())
                .build();
    }

}
