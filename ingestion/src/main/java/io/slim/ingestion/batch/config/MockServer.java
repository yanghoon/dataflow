package io.slim.ingestion.batch.config;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.github.tomakehurst.wiremock.WireMockServer;

@Configuration
public class MockServer {

    @Bean(initMethod = "start", destroyMethod = "stop")
    // @Profile("dev-wiremock")
    public WireMockServer wireMockServer() {
        WireMockServer wireMockServer = new WireMockServer(9090);
        
        wireMockServer.stubFor(get(urlEqualTo("/api/test"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withBody("Operational WireMock is working")));

        return wireMockServer;
    }

}
