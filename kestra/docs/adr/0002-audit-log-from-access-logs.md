# Kestra OSS 의 감사 로그는 Micronaut 내장 access logger 와 프록시 로그로 남긴다

Kestra OSS 에는 감사 로그(Enterprise 기능)가 없다. 그래서 "누가 무엇을 호출했나"는 두 로그로 남긴다.
하나는 Kestra 바이너리에 이미 들어 있는 Micronaut Netty access logger 로, 설정만으로 켠다. 다른 하나는 oauth2-proxy 의 request/auth 로그다.
사용자 식별은 프록시가 OIDC 클레임으로 덮어쓴 `X-Forwarded-Email` 에 기댄다. PoC 에서 사용자 구분과 위조 헤더 무시를 검증했다.

## Status

Accepted (2026-11-06, PoC 검증 완료)

## Context

- [ADR-0001](./0001-oidc-via-proxy-basic-header-injection.md) 구성에서 Kestra 는 모든 요청을 공용 계정 하나로 본다. 그래서 Kestra 의 실행·flow 기록만으로는 사람을 구분할 수 없다.
- 2.0.9 바이너리에 `io.micronaut.http.server.netty.handler.accesslog` 가 포함돼 있다. `micronaut.server.netty.access-logger.*` 설정으로 요청 헤더(`%{Header}i`)를 포함한 접근 로그를 남길 수 있다.
- 외부 모듈 금지 제약 때문에 Kestra 안에 감사용 필터를 추가할 수 없다.

## Decision

- Kestra: `micronaut.server.netty.access-logger` 를 켜고 logger 이름을 `kestra.audit` 로 둔다. 형식은 `%{X-Forwarded-For}i "%{X-Forwarded-Email}i" %t "%r" %s %b %D` 이고, 로그 수집기에서 이 logger 를 분리 수집한다.
- oauth2-proxy: `request_logging` 과 `auth_logging` 을 켠다. 로그인 성공·실패와 사용자별 요청이 남는다.
- 행위 기록은 Kestra access log, 인증 이벤트는 프록시 로그가 맡는다. 변경 내용(flow 본문)은 Kestra flow revision 이력과 대조한다.

## Considered Options

| 안 | 결과 |
|---|---|
| 프록시 로그만 사용 | 보조로 채택. 인증 이벤트는 여기에만 남는다. 다만 Kestra 에 실제로 도달한 요청인지는 보장하지 않는다 |
| Kestra access log 만 사용 | 주 로그로 채택. 로그인 실패 같은 인증 이벤트는 남지 않는다 |
| Kestra 안에 감사 필터(확장 jar) | 기각. 외부 모듈 금지 |
| Enterprise Audit Logs | 범위 밖(OSS 유지 전제) |

## Consequences

- 사용자 식별의 신뢰성은 "Kestra 에는 프록시를 거쳐서만 도달한다"는 전제에 기댄다. 운영에서는 NetworkPolicy 로 이를 강제한다.
  - 프록시를 우회하면 Kestra Basic Auth 가 401 로 막는다. 공용 자격증명이 유출되면 이메일이 빈 값(`"-"`)인 기록이 남으므로 이상 탐지에 쓸 수 있다.
- `X-Forwarded-For` 의 첫 값은 클라이언트가 위조할 수 있다. 신뢰할 IP 는 프록시가 붙인 마지막 값이다.
- 기록 단위는 HTTP 요청이다. "어떤 namespace 의 무엇"인지는 경로로 알 수 있지만, by-ids/by-query 같은 일괄 API 는 대상이 본문에 있어 경로만으로는 대상을 알 수 없다.
- UI 는 조회성 POST(차트 미리보기 등)를 자주 보낸다. 감사 조회 시 메서드와 경로로 걸러야 한다.
