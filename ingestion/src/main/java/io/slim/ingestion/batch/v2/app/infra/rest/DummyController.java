package io.slim.ingestion.batch.v2.app.infra.rest;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.contract.spec.internal.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/dummy")
public class DummyController {

    // 최초 접근 시간과 설정된 skip, expired를 담을 Record
    public record AccessLog(Instant firstAccessTime, int skip, int expired) {}

    private final Map<String, AccessLog> accessLogs = new ConcurrentHashMap<>();

    @Value("${app.dummy.download.location:/customers-100.csv}")
    private String location;
    
    @GetMapping("/download")
    ResponseEntity<Void> downloadFile(
        HttpServletRequest req,
        @RequestParam(name = "skip", defaultValue = "10") int skip,
        @RequestParam(name = "expired", defaultValue = "20") int expired
    ) {
        var clientIp = req.getRemoteAddr();

        Instant now = Instant.now();

        AccessLog log = accessLogs.get(clientIp);

        // 1. 최초 호출이거나(null), 등록된 만료 시간(info.expired())이 지났는지 확인
        if (log == null || Duration.between(log.firstAccessTime(), now).getSeconds() > log.expired()) {
            // 현재 요청받은 skip과 expired 값으로 새로운 상태(Record) 기록
            accessLogs.put(clientIp, new AccessLog(now, skip, expired));
            return ResponseEntity.ok().contentLength(0L).build();
        }

        // 2. Record에 저장된 최초 호출 시점 기준 skip 시간이 지났는지 확인
        long secondsSinceFirstAccess = Duration.between(log.firstAccessTime(), now).getSeconds();

        if (secondsSinceFirstAccess < log.skip()) {
            // 아직 대기 시간이 지나지 않음
            return ResponseEntity.ok().contentLength(0L).build();
        }

        return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(location))
                    .build();
    }

    @GetMapping("/status")
    public Map<String, AccessLog> getAccessLogStatus() {
        return accessLogs;
    }
}
