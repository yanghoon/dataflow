package io.slim.workflow.app.config;

import java.util.Map;
import java.util.stream.Collectors;

import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.core5.util.Timeout;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableConfigurationProperties({RestClientConfig.HttpProperties.class})
@RequiredArgsConstructor
public class RestClientConfig {

    private final HttpProperties props;

    @Bean
    public HttpComponentsClientHttpRequestFactory httpComponentsClientHttpRequestFactory() {
        RestClientConfiguration defaultProps = props.rest() != null ? props.rest().get("default") : null;
        
        long connectTimeout = defaultProps != null && defaultProps.connectTimeout() != null ? defaultProps.connectTimeout() : 5000;
        long readTimeout = defaultProps != null && defaultProps.readTimeout() != null ? defaultProps.readTimeout() : 5000;

        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(100);
        connectionManager.setDefaultMaxPerRoute(20);

        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofMilliseconds(connectTimeout))
                .setResponseTimeout(Timeout.ofMilliseconds(readTimeout))
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setDefaultRequestConfig(requestConfig)
                .build();

        return new HttpComponentsClientHttpRequestFactory(httpClient);
    }

    @Bean
    Map<String, RestClient> restClients(HttpComponentsClientHttpRequestFactory requestFactory) {
        if (props.http() == null) {
            return Map.of();
        }
        return props.http().entrySet().stream()
                    .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> create(e.getValue(), requestFactory)
                    ));
    }

    private RestClient create(HttpClientSpec spec, HttpComponentsClientHttpRequestFactory requestFactory) {
        var builder = RestClient.builder().requestFactory(requestFactory);
        
        if (StringUtils.hasText(spec.url())) {
            builder.baseUrl(spec.url());
        }

        if (spec.defaultRequestHeaders() != null) {
            spec.defaultRequestHeaders().forEach(builder::defaultHeader);
        }

        return builder.build();
    }

    @ConfigurationProperties("app")
    public record HttpProperties(Map<String, HttpClientSpec> http, Map<String, RestClientConfiguration> rest) {}

    public record HttpClientSpec(
        String url,
        Map<String, String> defaultRequestHeaders,
        String loggerLevel
    ) {}

    public record RestClientConfiguration(Long connectTimeout, Long readTimeout) {}
}
