# Kestra OSS 의 OIDC 로그인은 앞단 oauth2-proxy 가 맡고, Kestra 에는 공용 Basic 자격증명을 주입한다

Kestra OSS 에 SSO(OIDC)를 붙이되 포크·확장 jar 없이 업스트림 바이너리를 그대로 쓴다.
Kestra 2.0.9 바이너리에는 OIDC 모듈이 없어서, 앞단 oauth2-proxy 가 OIDC 로그인을 처리한다.
프록시는 upstream 요청에 사람이 모르는 공용 `Authorization: Basic` 을 주입하고, 응답에 쿠키 두 개(UI 로그인 플래그, CSRF 마커)를 심는다.
이 구성은 PoC(`kestra/verify/`, API 21건과 브라우저 6건)로 검증했다.

## Status

Accepted (2026-11-06, PoC 검증 완료. 권한(RBAC)은 이 ADR 범위 밖)

## Context

- 제약: 포크 금지, 업스트림 바이너리 그대로 사용, Kestra 에 붙이는 외부 모듈(확장 jar, javaagent) 금지. 내부 동작에 기대야 한다면 유지보수 비용이 가장 낮은 쪽을 고른다.
- Kestra OSS 2.0.9 는 Basic Auth 가 필수이고 계정은 하나뿐이다. SSO, 사용자 계정, RBAC 은 Enterprise 기능이다.
- 2.0.9 SBOM 에는 `micronaut-security` 코어와 csrf 만 있다. oauth2/jwt 모듈이 없으므로 Kestra 자체 설정으로는 OIDC 를 켤 수 없다.
- 소스에서 확인한 Kestra 동작:
  - `BasicAuthService` 는 `BASIC_AUTH` 쿠키를 먼저 보고, 없으면 `Authorization: Basic` 헤더를 본다. API 의 헤더 인증은 문서화된 동작이다.
  - UI 는 `document.cookie` 에 `kestraBasicAuthenticated=true` 가 있는지로만 로그인 여부를 판단한다(`ui/src/utils/basicAuth.ts`).
  - `CsrfTokenFilter` 는 요청에 `BASIC_AUTH` 또는 `JWT` 쿠키가 **있을 때만** CSRF 토큰을 검사한다. 쿠키 값의 유효성은 보지 않는다.

## Decision

- oauth2-proxy(alpha config)를 Kestra 앞에 둔다. Kestra 포트는 외부에 노출하지 않는다.
- 요청에 주입하는 헤더:
  - `Authorization: Basic <공용 계정>`. 값은 env 로 받고, 클라이언트가 보낸 같은 이름의 헤더는 제거된다.
  - `X-Forwarded-Email` / `X-Forwarded-User`. 감사 로그용이며 OIDC 클레임으로 덮어쓴다.
- 응답에 주입하는 `Set-Cookie`(한 헤더에 값 두 개):
  - `kestraBasicAuthenticated=true`: UI 가 Kestra 로그인 화면을 건너뛴다.
  - `JWT=csrf-marker; HttpOnly`: 인증에는 쓰이지 않는 마커다. Kestra 의 CSRF 검사를 브라우저 요청에 다시 켠다.
- webhook trigger(`POST /api/v1/*/executions/webhook/`)만 OIDC 없이 통과시킨다. webhook 은 Kestra 자체의 key 로 보호된다.
- 응답 헤더 값은 `fromEnv` 로 넣는다. oauth2-proxy v7.15.6 은 응답 헤더의 `secretSource.value` 를 base64 디코딩하지 않는다(관찰).

## Considered Options

| 안 | 결과 |
|---|---|
| Kestra 자체 OIDC 설정 | 기각. 바이너리에 oauth2/jwt 모듈이 없다 |
| `micronaut.security.enabled=true` 로 OSS 인증 끄고 프록시에만 의존 | 기각(미검증). 문서화되지 않은 내부 스위치다. 프록시가 뚫리면 API 가 무인증이 된다. 현재안은 Kestra Basic Auth 가 두 번째 벽으로 남는다 |
| 확장 jar(Micronaut `@Replaces`) 또는 javaagent | 기각. 외부 모듈 금지 제약 위반이고, 내부 클래스에 결합한다 |
| 프록시가 `BASIC_AUTH` 쿠키 주입 | 기각(검증 실패). 쿠키를 덧붙이면 Cookie 헤더가 두 줄이 되고 Kestra 는 첫 줄만 읽어 401 이 난다. 쿠키를 교체하면 `csrfToken` 쿠키가 사라져 CSRF 검증이 깨진다 |
| `Authorization` 헤더만 주입 | 기각(검증). 동작은 하지만 CSRF 검사가 꺼진다. 같은 site 서브도메인에서 보낸 multipart 폼 POST 가 200 을 받았다. cross-site 요청은 SameSite=Lax 가 막았다 |
| 공용 계정으로 이중 로그인(SSO 후 Kestra 로그인) | 기각. 공용 비밀번호를 사람에게 배포해야 한다 |

## Consequences

- 업그레이드 때 확인할 내부 계약은 쿠키 이름 두 개다(`kestraBasicAuthenticated`, CSRF 필터의 `JWT`).
  - CSRF 계약이 바뀌면 **기능 증상 없이 보호만 꺼진다.** 그래서 `verify/verify.sh` [3b] 와 `verify/ui.sh` UI-3 을 버전업 게이트로 둔다.
- 공용 Basic 비밀번호를 회전할 때는 Kestra 설정과 프록시 env 를 함께 바꿔야 한다(ESO 의 같은 Secret 에서 둘 다 주입).
- 프록시를 통과한 사용자는 Kestra 안에서 모두 같은 공용 계정이다. 권한 구분은 Kestra 가 아닌 앞단에서 해야 한다(후속 ADR).
- UI 로그아웃은 Kestra 쿠키만 지운다. 새로고침하면 OIDC 세션으로 복귀하고, 완전한 로그아웃은 `/oauth2/sign_out` 이다.
- oauth2-proxy alpha config 는 업스트림이 "예고 없이 바뀔 수 있음"으로 표기한다. 버전은 고정한다.
