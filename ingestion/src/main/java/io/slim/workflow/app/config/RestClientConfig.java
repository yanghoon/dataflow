package io.slim.workflow.app.config;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import io.slim.workflow.app.config.RestClientConfig.HttpProperties;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableConfigurationProperties(HttpProperties.class)
@RequiredArgsConstructor
public class RestClientConfig {

    private final HttpProperties props;

    @Bean
    Map<String, RestClient> restClients() {
        if (props.http() == null) {
            return Map.of();
        }
        return props.http().entrySet().stream()
                    .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> create(e.getValue())
                    ));
    }

    private RestClient create(HttpClientSpec spec) {
        var builder = RestClient.builder();
        
        if (StringUtils.hasText(spec.url())) {
            builder.baseUrl(spec.url());
        }

        if (spec.defaultRequestHeaders() != null) {
            spec.defaultRequestHeaders().forEach(builder::defaultHeader);
        }

        return builder.build();
    }

    @ConfigurationProperties("app")
    public record HttpProperties(Map<String, HttpClientSpec> http) {}

    public record HttpClientSpec(
        String url,
        Map<String, String> defaultRequestHeaders,
        String loggerLevel
    ) {}

}
