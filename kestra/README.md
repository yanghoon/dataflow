# Kestra OSS — OIDC 로그인 + 감사 로그 검증

**결론: 포크·확장 jar 없이, 업스트림 Kestra 바이너리(v2.0.9)에 설정만 바꿔서 OIDC 단일 로그인과 사용자 단위 감사 로그가 동작한다.**
oauth2-proxy 하나를 앞에 두고, Kestra 쪽은 설정 키만 바꾼다. 검증은 API 21건과 실제 브라우저 6건이며 모두 통과했다(2026-11-06).

결정 기록: [ADR-0001 OIDC](docs/adr/0001-oidc-via-proxy-basic-header-injection.md), [ADR-0002 감사 로그](docs/adr/0002-audit-log-from-access-logs.md), [ADR-0003 권한(제안, 미검증)](docs/adr/0003-rbac-via-gateway-route-classification-and-tenant-instances.md)

제약 조건: 포크 금지, 업스트림 바이너리 그대로 사용, Kestra에 붙이는 외부 모듈(확장 jar, javaagent) 금지.
내부 동작에 기대는 부분이 생기면 유지보수 비용이 가장 낮은 쪽을 고른다.

## 1. 대안 검토

| 방안 | 결과 | 근거 |
|---|---|---|
| Kestra 자체 OIDC 설정 | ❌ 불가 | 2.0.9 SBOM에 `micronaut-security` 코어와 csrf만 있고 oauth2/jwt 모듈이 없다 |
| `micronaut.security.enabled=true`로 OSS 인증 끄기 | ✖ 채택 안 함(미검증) | 문서화되지 않은 내부 스위치(`@Requires`)다. 프록시가 뚫리면 API가 무인증으로 열린다 |
| 확장 jar, javaagent | ✖ 제약 위반 | 외부 모듈 금지 |
| 프록시가 `BASIC_AUTH` 쿠키 주입 | ❌ 실패(검증) | 쿠키를 덧붙이면 Cookie 헤더가 두 줄이 되고 Kestra는 첫 줄만 읽어 401이 난다. 쿠키를 교체하면 `csrfToken` 쿠키가 사라진다 |
| 프록시가 `Authorization: Basic` 헤더만 주입 | ⚠️ 동작하지만 CSRF 구멍(검증) | Kestra CSRF 필터가 꺼져서 같은 site 서브도메인에서 보낸 폼 POST가 200을 받는다 |
| **헤더 주입 + UI 플래그 쿠키 + CSRF 마커 쿠키** | ✅ **채택** | 아래 3절 |

## 2. 구조

```
브라우저 ─▶ oauth2-proxy :4180 ─────────────────────────▶ kestra :8080 (외부 비노출)
            │ OIDC 로그인 (dex = 검증용 IdP)          upstream 요청에 주입:
            │                                          Authorization: Basic <공용계정>   ← 사람은 모름
            │                                          X-Forwarded-Email: <OIDC email>   ← 클라이언트 값 제거 후 덮어씀
            │ 응답에 주입:
            │   Set-Cookie: kestraBasicAuthenticated=true   ← UI 가 로그인 화면을 건너뜀
            │   Set-Cookie: JWT=csrf-marker (HttpOnly)       ← Kestra CSRF 검사를 다시 켬
            └ webhook(POST /api/v1/*/executions/webhook/...) 만 OIDC 없이 통과
```

| 파일 | 역할 |
|---|---|
| `compose.yaml` | postgres, kestra(v2.0.9-no-plugins), dex, oauth2-proxy |
| `oauth2-proxy/alpha.yaml` | upstream, 요청/응답 헤더 주입, OIDC provider |
| `oauth2-proxy/oauth2-proxy.cfg` | 쿠키, 이메일 도메인, 요청 로그, webhook 예외 |
| `dex/config.yaml` | 검증용 사용자 alice/bob (비밀번호 `password`) |
| `verify/verify.sh` | curl로 API 경로 검증 (21건) |
| `verify/ui.sh`, `verify/ui.mjs` | Playwright(Chromium)로 UI와 CSRF 검증 (6건) |

## 3. 장치별 이유

1. **`Authorization: Basic` 주입:** Kestra API가 공개적으로 지원하는 인증 방식이다(문서화됨). 공용 계정은 프록시만 안다. 클라이언트가 보낸 Authorization 헤더는 프록시가 제거한다.
2. **`kestraBasicAuthenticated=true` 쿠키:** OSS UI는 `document.cookie`에 이 값이 있는지로만 로그인 여부를 판단한다(`ui/src/utils/basicAuth.ts`). 이 쿠키가 없으면 Kestra 로그인 화면이 한 번 더 뜬다.
3. **더미 `JWT` 쿠키:** `CsrfTokenFilter`는 요청에 `BASIC_AUTH`나 `JWT` 쿠키가 있을 때만 CSRF 토큰을 검사한다. 헤더 주입만 하면 브라우저 요청도 "API 클라이언트"로 취급돼 검사가 꺼진다. 인증에 쓰이지 않는 `JWT` 쿠키를 심으면 UI 요청은 정상 토큰으로 통과하고, 토큰이 없는 위조 요청은 403을 받는다.
4. **감사 로그는 두 계층이고 둘 다 설정만으로 켜진다.**
   - Kestra: Micronaut Netty 내장 access logger(`micronaut.server.netty.access-logger`) — 사용자의 행위를 기록
     ```
     kestra.audit 192.168.65.1 "alice@example.com" [06/Nov/2026:13:02:59 +0000] "POST /api/v1/main/flows HTTP/1.1" 409 226 20
     ```
   - oauth2-proxy: `request_logging`과 `auth_logging` — 로그인 성공·실패와 요청을 기록
     ```
     ... - alice@example.com [2026/11/06 13:02:18] kestra.localtest.me:4180 POST kestra "/api/v1/main/..." ... 200
     ```
   - "무엇을 바꿨나"(flow 내용)는 Kestra의 flow revision 이력과 같이 본다.

## 4. 검증 결과

```bash
cd kestra
docker compose up -d          # kestra 기동 ~15초
./verify/verify.sh            # 결과: PASS=21 FAIL=0
./verify/ui.sh                # 결과: PASS=6  FAIL=0  (스크린샷: verify/out/)
```

| 항목 | 결과 |
|---|---|
| 세션이 없으면 IdP로 리다이렉트, API는 401 | ✅ |
| Basic 헤더를 직접 위조해도 세션이 없으면 401 | ✅ |
| OIDC 로그인 한 번으로 UI 진입(Kestra 로그인 화면 없음), flow 목록과 실행 | ✅ 브라우저 |
| CSRF 토큰이 없거나 틀린 POST는 403, UI 요청은 200 | ✅ |
| cross-site 폼 POST 차단(SameSite=Lax, 302) | ✅ 브라우저 |
| **같은 site 서브도메인 폼 POST 차단(Kestra CSRF, 403)** | ✅ 브라우저. 마커 쿠키가 없으면 200(취약)이었다 |
| 감사 로그에 실제 사용자(alice/bob 구분), 위조한 `X-Forwarded-Email`은 무시 | ✅ |
| webhook은 세션 없이 200, 잘못된 key는 404 | ✅ |
| webhook 예외 경로로 traversal(`../`, `%2e%2e`) 시도 시 upstream 미도달 | ✅ |
| 프록시를 우회해 내부망에서 직접 호출하면 Kestra Basic Auth가 401 | ✅ |

## 5. 깨지는 조건 (업그레이드 때 확인할 계약)

| # | 의존하는 동작 | 성격 | 깨지면 | 탐지 |
|---|---|---|---|---|
| 1 | API가 `Authorization: Basic`을 받음 | 공개, 문서화됨 | 전부 401 | verify [3] |
| 2 | UI가 쿠키 `kestraBasicAuthenticated=true`로 로그인을 판단 | **내부** | Kestra 로그인 화면이 뜸(기능은 안전) | ui UI-1 |
| 3 | CSRF 필터가 `JWT`/`BASIC_AUTH` 쿠키가 있는지로 동작 | **내부** | **CSRF 보호가 조용히 꺼짐** | verify [3b], ui UI-3 same-site |
| 4 | webhook 경로 `/api/v1/{tenant}/executions/webhook/` | 공개 API | 외부 webhook 401 | verify [6] |
| 5 | oauth2-proxy alpha config 문법 | 업스트림이 alpha로 표기 | 프록시가 기동 실패 | 기동 로그 |
| 6 | oauth2-proxy 응답 헤더의 `secretSource.value`가 디코딩되지 않음(그래서 `fromEnv` 사용) | 관찰된 동작 | 쿠키 값이 깨짐 | verify [3] |

**가장 저렴한 유지보수 방법:** Kestra와 oauth2-proxy 버전은 고정한다. 올릴 때는 이 디렉터리에서 이미지 태그만 바꾸고 `verify.sh`와 `ui.sh`를 돌린다.
3번은 깨져도 기능상 증상이 없으므로 **이 테스트가 유일한 방어선**이다. CI에 넣는 것을 권장한다.
내부 계약은 쿠키 이름 두 개뿐이고, 고칠 곳은 `compose.yaml`의 환경변수 두 줄이다.

## 6. 운영 전환 시 할 일 (이 PoC에서는 안 한 것)

- HTTPS로 서비스하고 `cookie_secure = true`로 바꾼다. 쿠키 마커에 `Secure`를 추가한다.
- 비밀값은 ESO에서 Secret으로 받아 env/file로 주입한다: `KESTRA_BASIC_AUTH_HEADER`, client secret(`clientSecretFile`), cookie secret.
- NetworkPolicy로 Kestra 8080/8081에는 oauth2-proxy만 들어오게 막는다. 8081은 무인증 관리 포트다.
- 사내 IdP로 바꾼다. 접근 대상은 `email_domains`나 `allowed_groups`로 제한한다.
- CI 같은 API 클라이언트는 미검증이다. 후보는 (a) 내부망에서 Basic으로 직접 호출, (b) oauth2-proxy `skip_jwt_bearer_tokens`로 IdP 토큰을 받는 방식이다.
- 감사 로그는 stdout으로 나오므로 로그 수집기에서 `kestra.audit` logger로 분리 수집한다.

## 7. 한계

- **권한은 "로그인 가능 = 관리자" 한 단계뿐이다.** RBAC과 조회 범위 격리는 이 구성으로 해결되지 않는다. 테넌트별 인스턴스 분리와 같이 쓴다.
- UI에서 로그아웃하면 Kestra 로그인 화면이 뜬다. 새로고침하면 OIDC 세션으로 바로 복귀한다. 완전한 로그아웃은 `/oauth2/sign_out`이다.
- `X-Forwarded-For`의 첫 값은 클라이언트가 위조할 수 있다. 신뢰할 IP는 마지막 값(프록시가 붙인 값)이다.
- 공용 Basic 비밀번호를 바꿀 때는 Kestra 설정과 프록시 env를 같이 바꿔야 한다.
