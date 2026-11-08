# Kestra OSS 의 권한은 테넌트별 인스턴스로 격리하고, 인스턴스 안의 역할은 앞단 게이트웨이가 메서드·경로 분류로 판정한다

Kestra OSS 에는 RBAC 이 없다. [ADR-0001](./0001-oidc-via-proxy-basic-header-injection.md) 구성에서 Kestra 는 모든 사용자를 공용 계정 하나로 본다.
그래서 권한은 두 층으로 나눈다. namespace 집합(테넌트) 단위의 격리는 테넌트별 Kestra 인스턴스로 한다.
인스턴스 안의 역할(viewer/operator/editor/admin)은 앞단 게이트웨이가 요청의 메서드와 경로를 분류하고, IdP 그룹과 대조해 판정한다.
분류되지 않은 쓰기 요청은 admin 만 허용한다(기본 거부).

## Status

Proposed (2026-11-06). 설계만 했고 PoC 는 하지 않았다. 아래 "검증할 것"을 마치면 Accepted 로 바꾼다.

## Context

- 제약: 포크 금지, 업스트림 바이너리 그대로 사용, Kestra 에 붙이는 외부 모듈(확장 jar, javaagent) 금지. 내부 동작에 기대야 한다면 유지보수 비용이 가장 낮은 쪽을 고른다.
- 2.0.9 OpenAPI(`META-INF/swagger/kestra.yml`) 분석 결과:
  - 엔드포인트는 216개다(GET 100, POST 84, PUT 11, DELETE 20, PATCH 1).
  - 쓰기 요청(GET 이 아닌 것) 116개 중 **경로에 `{namespace}` 가 있는 것은 22개뿐**이다.
  - 나머지는 `executionId` 로 대상을 지정하거나(`/executions/{executionId}/kill` 등), 본문으로 지정한다(`by-ids`, `by-query`).
  - 목록·검색 같은 조회 API 는 namespace 를 가리지 않고 결과를 돌려준다.
- 따라서 경로만 보는 게이트웨이로는 namespace 단위 권한을 나눌 수 없다. 나누려면 본문을 파싱하고 Kestra 를 역조회하고 응답을 필터링해야 한다. 이는 사실상 Kestra RBAC 을 다시 구현하는 일이다.
- oauth2-proxy 는 그룹 검사를 전역으로만 한다(`allowed_groups`). `/oauth2/auth?allowed_groups=a,b` 형태로 요청마다 그룹을 지정할 수는 있다. 하지만 메서드와 경로를 함께 보고 판정하지는 못한다.

## Decision

### 층 1. 테넌트 격리 = 인스턴스 분리

- 테넌트(관련 namespace 의 묶음)마다 Kestra 인스턴스, 게이트웨이, 공용 Basic 자격증명을 따로 둔다.
- 접근 그룹은 `kestra-<tenant>-<role>` 이다. 다른 테넌트 그룹을 가진 사용자는 인증 단계에서 거부된다.
- 조회 격리, 시크릿·KV 분리, 장애 범위 분리는 이 층에서만 보장된다.

### 층 2. 인스턴스 안 역할 = 게이트웨이의 경로 분류

상위 역할은 하위 역할의 권한을 모두 가진다.

| 역할 | 허용 범위 | 대표 경로 |
|---|---|---|
| viewer | GET 전체(민감 조회는 제외) + 조회성 POST | `flows/search`, `dashboards/*/charts/preview`, `flows/graph`, `flows/validate`, `namespaces/autocomplete` |
| operator | viewer + 실행 제어 | 실행 생성, `restart`/`replay`/`kill`/`pause`/`resume`(단건·by-ids·by-query), `labels`, trigger `backfill`/`unlock`/`set-disabled` |
| editor | operator + 정의 변경 | flow CRUD/import/bulk, `namespaces/{ns}/files`, `kv`, concurrency-limit, 로그·실행 삭제 |
| admin | 전부 | `plugins/install`, `mcp-servers`, `basicAuth`, `ai/*`, `expressions/render`, `executions/{id}/eval` |

- **쓰기 요청 중 분류에 없는 것은 admin 전용이다(기본 거부).** 업그레이드로 새 API 가 생기면 권한이 새는 대신 403 이 난다.
- 조회는 viewer 에게 기본 허용하고, 막을 것만 나열한다. 대상은 KV 값 조회와 실행 산출물 파일 다운로드다.
- 표현식을 서버에서 평가하는 API(`expressions/render`, `eval`)는 `secret()` 을 평가해 시크릿을 꺼낼 수 있을 가능성이 있어 admin 전용으로 둔다(미검증).
- editor 권한은 사람에게 주지 않는 것을 기본으로 한다. flow 와 namespace 파일 변경은 Git PR → CI 서비스 계정(editor)으로만 받는다. Git 이력이 변경 내용의 감사 기록이 된다([ADR-0002](./0002-audit-log-from-access-logs.md) 의 빈틈 보완).

### 게이트웨이 구현

```
브라우저 / CI ─▶ nginx (테넌트별)
                 │ map: (메서드, 경로) → 필요한 그룹 목록       ← 분류 파일. 설정만
                 │ auth_request → oauth2-proxy /oauth2/auth?allowed_groups=<그룹 목록>
                 │ 허용 시 주입: Authorization: Basic, X-Forwarded-Email, 쿠키 2개(ADR-0001)
                 └ 접근 로그: user, groups, 분류, 허용/거부, status
                       ▼
                 kestra-<tenant> (외부 비노출)
```

- nginx 는 표준 이미지를 쓰고 설정만 바꾼다. oauth2-proxy 는 인증만 맡는다(auth-request 모드).
- CI 와 서비스 계정은 IdP client-credentials 토큰으로 접근한다(oauth2-proxy `skip_jwt_bearer_tokens`). 사람과 같은 그룹 규칙을 적용한다.

## Considered Options

| 안 | 결과 |
|---|---|
| 단일 인스턴스 + 경로 기반 namespace RBAC | 기각. 쓰기 116개 중 94개는 경로에 namespace 가 없다 |
| 본문 파싱·executionId 역조회·응답 필터링을 하는 권한 프록시(Envoy ext_authz + OPA, 직접 만든 서비스) | 기각. Kestra RBAC 을 다시 구현하는 일이고, API 216개의 본문과 의미에 결합한다. 유지보수 비용이 가장 크다 |
| oauth2-proxy 단독 | 기각. 메서드·경로 단위로 판정할 수 없다 |
| **nginx(map + auth_request) + oauth2-proxy** | **채택(제안)**. 코드 없이 설정만으로 된다 |
| Envoy Gateway SecurityPolicy(OIDC + JWT 클레임 인가) | 보류. 클러스터 표준이 Envoy Gateway 라면 nginx 와 oauth2-proxy 를 둘 다 대체할 수 있다. 미검증 |
| Spring Cloud Gateway(직접 만든 인증·인가 게이트웨이) | 보류. 아래 참고 |
| ingress-nginx 어노테이션(auth-url) | 기각. 메서드 단위로 판정하려면 snippet 이 필요하고, snippet 은 기본적으로 꺼져 있다 |

### Spring Cloud Gateway 를 쓰는 경우

- **경로 분류만 하는 용도(nginx + oauth2-proxy 를 대체):** 가능하다. Spring Security `oauth2Login` 이 OIDC 를, route filter 가 Basic 헤더와 쿠키 주입을, `authorizeExchange` 가 메서드·경로·그룹 판정을 맡는다. 컴포넌트가 하나로 줄고 Java 팀이 익숙하다. 대신 설정이 아니라 **우리가 소유하는 보안 애플리케이션**이 생긴다. 의존성 CVE 대응, 빌드·배포, 세션 저장소(다중 replica 시 Spring Session)를 직접 관리해야 한다. 판정 능력은 nginx 안과 같다.
- **namespace RBAC 까지 하는 용도(코드로 본문 파싱과 역조회):** 기술적으로는 가능하다. 하지만 위의 "권한 프록시" 기각 사유가 그대로 적용된다. 목록·검색 응답을 걸러내면 페이지네이션과 집계 수치가 틀어지고, SSE 로그 스트림도 다뤄야 한다. Kestra 를 올릴 때마다 API 의미 변화를 따라가야 한다.

## Consequences

- 유지보수 대상은 분류 파일 하나(nginx map)와 테스트 세 종류다.
  - **스펙 비교(업그레이드 게이트):** 새 이미지의 `kestra.yml` 경로 중 분류 파일에 없는 것이 있으면 CI 를 실패시킨다. 새 쓰기 API 는 원래 403 이라 안전하지만, **새 GET API 는 viewer 에게 열리므로** 이 검사로 잡는다.
  - **역할 × 대표 API 매트릭스 테스트**를 둔다.
  - ADR-0001 의 verify(쿠키 계약)를 그대로 돌린다.
- 인스턴스 안에서는 namespace 를 구분하지 않는다. 구분이 필요하면 테넌트를 나눈다.
- UI 는 역할을 모른다. viewer 에게도 실행 버튼이 보이고, 누르면 403 이 난다.
- viewer 는 실행 로그와 출력을 볼 수 있다. 민감한 데이터를 로그에 남기는 flow 는 별도 테넌트로 둔다.
- 테넌트 수만큼 인스턴스가 생긴다. DB 스키마를 공유할지는 운영 비용을 보고 별도로 정한다.

## 검증할 것 (PoC)

1. `/oauth2/auth?allowed_groups=a,b` 가 그룹 중 하나만 맞아도 허용하는지, 그룹이 맞지 않을 때 어떤 코드를 돌려주는지
2. 그룹 클레임을 주는 IdP(Keycloak dev 모드). dex 의 정적 사용자는 그룹을 지원하지 않는다
3. 역할 4개 × 대표 API 매트릭스
4. viewer 가 UI 에서 403 을 만났을 때 오류만 표시되는지, 로그아웃 처리되는지
5. `expressions/render` 가 `secret()` 을 평가하는지
6. 스펙 비교 스크립트
