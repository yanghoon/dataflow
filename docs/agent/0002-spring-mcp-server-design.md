# Spring MCP 서버·REST·인가 설계

2026-11-02 · @Hoon

## 상태와 요약

**상태:** Proposed (검토용). [0001](0001-hybrid-request-ux-architecture.md)의 "백엔드 MCP 도구 서버"와 "인가(OPA)" 부분을 구체화하고 대체한다.

**결정:**

- Flue는 MCP 서버를 제공하지 않는다(0001 확인). 그래서 MCP 서버는 백엔드와 같은 언어인 Spring으로 구현한다.
- 앱은 하나로 배포하고, Spring Modulith로 `domain`, `rest`, `mcp` 모듈을 나눈다.
- Gradle 모듈 이름은 `console`이다(사용자용 서비스: 화면, REST, MCP). 형제 모듈 `ingestion`, `airbyte`는 데이터 플랫폼 내부 구성요소다.
- **이번 범위에 웹(SPA)은 없다.** 나중에 `console-web`(React 빌드)을 만들어 web jar로 `console`에 포함한다. 그때 SPA 로그인용 OAuth2 client와 세션을 추가한다. 지금은 Bearer JWT 검증(resource server)만 한다.
- 인증은 Spring Security OAuth2 Resource Server(OIDC JWT 검증)를 설정 위주로 구성한다.
- 인가는 Casbin을 `domain`이 쓰는 한 벌로 둔다. OPA는 쓰지 않는다.

## 모듈 구조

Gradle 모듈 `console` 안에서 Modulith가 아래 세 모듈을 나눈다. 패키지 루트는 `io.slim.console`이다.

| 모듈 | 역할 | 의존 |
| --- | --- | --- |
| `domain` | 비즈니스 데이터, 업무 로직, 스키마 검증, 권한 판정(Casbin), 감사. 애플리케이션 서비스 인터페이스(포트)를 공개한다 | 없음 |
| `rest` | REST 컨트롤러(이후 SPA가 호출). 포트 호출과 DTO 변환만 한다 | `domain` |
| `mcp` | MCP 도구 정의. 포트 호출과 입출력 변환만 한다. MCP 호출 로그는 쓸 수 있다 | `domain` |

- `rest`와 `mcp`는 서로 참조하지 않는다. `ApplicationModules.verify()` 테스트로 강제한다.
- 비즈니스 데이터와 로직은 모두 `domain`에 둔다. `mcp`는 로그 같은 횡단 관심사만 가진다.
- **REST 교체 가능성:** 나중에 MCP가 REST를 통해 호출해야 하면 포트 구현만 REST 클라이언트 어댑터로 바꾼다. 그래서 `mcp`는 저장소를 직접 쓰지 않고 포트만 호출한다.
- 도구 입력 스키마는 `domain`의 신청 스키마를 재사용한다(0001: 정답 기준은 JSON Schema 하나).

## 인증

- Spring Security `oauth2ResourceServer().jwt()`로 IdP JWKS를 검증한다. `iss`와 `aud`(MCP 서버 자신)를 검증한다.
- Claude Code가 MCP 서버에 직접 붙어 사용자 JWT로 호출한다. 같은 앱이 `aud`를 검증하므로 MCP 입구에서는 token passthrough 문제가 없다.
- **토큰 교환(RFC 8693)은 일단 하지 않는다.** Flue → Spring MCP 구간은 IdP가 `aud`를 `[flue, mcp]`로 발급하거나 Spring이 Flue용 `aud`를 함께 허용한다. 감수하는 점: Flue가 뚫리면 토큰이 MCP까지 통한다(token passthrough 금지 위반 소지). 대리 주체(`act`)가 없어 직접 호출과 대리 호출을 토큰으로 구분하지 못하므로, 감사 로그에 `azp`(클라이언트 ID)를 남긴다. 에이전트에 사용자보다 좁은 권한을 줄 수 없다. 외부 에이전트 이용이 늘면 재검토한다.
- Spring AI MCP 서버를 쓴다(WebMVC, Streamable HTTP, JWT 전용). OAuth2 보호는 커뮤니티 모듈 `org.springaicommunity:mcp-server-security`로 구성하고, 버전을 고정한다. `validateAudienceClaim`을 켠다.
- MCP 서버는 401과 보호 리소스 메타데이터(RFC 9728)를 제공해야 한다.
- oauth2-proxy는 브라우저 로그인용이며 MCP OAuth 탐색과 DCR을 제공하지 않는다. 대안이 되지 않는다.

## 인가 (Casbin)

- Spring Security는 인증과 호출 지점(`@PreAuthorize`, 서비스 메서드 보안)을 맡는다. 판정은 `domain`의 Casbin Enforcer가 한다.
- 모델은 `(역할, 리소스, 행위)` RBAC로 시작한다. 정책은 CNPG(JDBC 어댑터)에 저장한다.
- 신청 유형별로 `resource`를 두면 REST와 MCP 도구가 같은 정책을 쓴다.
- 판정은 `domain` 서비스 안에서 한다. 입구(`rest`, `mcp`)가 달라도 우회할 수 없다.

## 미정·검토 사항

- [ ] **IdP의 동적 클라이언트 등록(DCR) 지원 여부.** 미지원이면 Claude Code용 클라이언트를 사전 등록하고 client id를 직접 지정한다(사용 버전에서 방식 확인). 인가 서버 앞단 파사드(Spring Authorization Server)도 대안이다.
- [ ] **Casbin의 역할 출처.** (a) IdP 토큰의 groups/roles 클레임을 매핑(권장), (b) Casbin 정책 테이블에 사용자→역할을 직접 저장.
- [ ] IdP가 `aud`를 `[flue, mcp]`로 발급할 수 있는지(토큰 교환을 하지 않는 대신 필요).
- [ ] `mcp-server-security`가 커뮤니티 모듈이라는 점을 감수할지, 순수 Spring Security 설정으로 직접 구성할지.
- [ ] 0001의 OPA 관련 서술을 이 문서 기준으로 정리.
- [x] **`console`만 단독으로 Boot 4.1.2를 적용한다(모듈 `plugins {}`에서 버전 재정의).** 저장소 전체 업그레이드는 나중에 한다. 형제 모듈(`ingestion`, 4.0.7)과 같은 플러그인을 다른 버전으로 쓸 때 Gradle이 오류를 내는지는 첫 빌드로 확인한다. 안 되면 대응을 다시 정한다.
- [ ] 아래 버전 제안을 스모크 빌드(의존 해석, 빈 컨텍스트 기동)로 확정.

## 다음 단계

1. 이 문서의 미정 항목 정리(IdP 확인, 버전 확정)
2. 구현 계획: `console` 모듈 골격 → `project.create` 한 흐름 → 테스트(아래 1·2단계)
3. 후속: `console-web`(SPA, web jar), 승인자 교체, 사용자 검색, 알림

## 상세 설계 (신청 1건 흐름)

흐름은 `신청서 목록 → 스키마 조회 → 임시저장(draft) → 제출 → 내 이력`이다. 제출은 웹 폼에서만 한다(0001: 채팅은 보조). 외부 에이전트가 MCP로 직접 제출하는 것은 초기에 허용하지 않고, 승인 정책이 정해지면 연다.

### 포트 (`domain` 공개 인터페이스)

| 포트 | 메서드 | REST | MCP |
| --- | --- | --- | --- |
| `RequestCatalog` | `listTypes()`, `getSchema(type)` | O | O |
| `RequestDrafts` | `create(type, data)`, `update(id, data)` | O | O (생성만) |
| `RequestSubmission` | `submit(draftId)`, `cancel(id)` | O | **X** |
| `RequestHistory` | `listMine()`, `get(id)` | O | O |
| `RequestApproval` | `listAssignedToMe()`, `approve(id)`, `reject(id)` | O | 조회(`listAssignedToMe`)만. 승인·반려는 **X** (사람의 결정) |

### REST (`rest` 모듈)

| 메서드 · 경로 | 포트 | Casbin 리소스 · 행위 |
| --- | --- | --- |
| `GET /api/request-types` | `listTypes` | 유형별 `request-type:{type}` · `read`로 필터링 |
| `GET /api/request-types/{type}/schema` | `getSchema` | `request-type:{type}` · `read` |
| `POST /api/requests/drafts` | `create` | `request-type:{type}` · `draft` |
| `PUT /api/requests/drafts/{id}` | `update` | 소유자 확인 후 `draft` |
| `POST /api/requests/{id}/submit` | `submit` | `request-type:{type}` · `submit`, 스키마 전체 검증 |
| `POST /api/requests/{id}/cancel` | `cancel` | 신청자 본인, 승인 진행 중일 때만 |
| `GET /api/requests`, `GET /api/requests/{id}` | `listMine`, `get` | 본인 것만 |
| `GET /api/approvals` | `listAssignedToMe` | 나에게 지정된 승인만 |
| `POST /api/approvals/{id}/approve`, `.../reject` | `approve`, `reject` | 지정 승인자만. 아니면 404 |

- REST 기본 경로는 `/api`다.
- 오류: 400은 필드별 검증 오류 목록, 404는 없음 **또는 권한 없음**(GitHub 방식, 존재 여부를 드러내지 않는다). 실제 거부 사유는 서버 로그·감사 로그에만 남긴다.
- 소유권(본인 것만)은 Casbin 정책이 아니라 `domain` 서비스가 `owner == sub`로 확인한다.

### MCP 도구 (`mcp` 모듈, 제출 도구 없음)

| 도구 | 포트 | 비고 |
| --- | --- | --- |
| `list_request_types` | `listTypes` | 권한 있는 유형만 |
| `get_request_schema` | `getSchema` | JSON Schema 반환 |
| `create_request_draft` | `create` | 반환: `draftId`와 웹 폼 URL. 사용자가 폼에서 확인하고 제출한다 |
| `list_my_requests`, `get_request` | `listMine`, `get` | 읽기 전용. 각 항목에 웹 상세 URL 포함 |
| `list_my_approvals` | `listAssignedToMe` | 내게 지정된 승인 대기 목록. 각 항목에 웹 승인 화면 URL 포함. 읽기 전용 |

- 도구 입력 스키마는 `getSchema`가 주는 신청 스키마를 재사용한다. 도구 오류는 REST와 같은 메시지를 `isError`로 돌려준다.
- 중첩 스키마는 elicitation(평면·원시 타입만 허용)을 쓰지 않고 폼 링크를 반환한다.
- **링크 유도:** 사람이 결정하거나 확인할 단계(제출, 승인, 반려, 상세)는 도구 결과에 웹 URL을 함께 돌려줘, 사용자가 바로 웹으로 이동하게 한다. URL은 화면 경로(`/requests/:type?draft={id}`, 승인 화면, 신청 상세)이며 웹이 아직 없으므로 경로 규약만 정해 둔다. 링크를 열어도 권한은 웹에서 다시 판정한다.

### 확정한 세부 결정

- draft는 부분 입력을 허용하고 스키마 전체 검증은 제출 때 한다. 만료는 7일이다.
- 멱등성은 클라이언트 키가 아니라 상태 전이로 보장한다. draft ID는 서버가 발급하고, `submit`은 `DRAFT → IN_APPROVAL`로 한 번만 바꾼다. 재제출은 첫 결과를 돌려준다.
- 폼 URL은 `/requests/:type?draft={id}`이고, draft는 소유자만 열 수 있다. 아니면 404다.

### 첫 신청 유형: `project.create`

사용자는 프로젝트 정보, 구성원, **승인자**를 직접 입력한다. 승인자 자동 지정(조직 계층 기반)은 후속 기능이다.

| 필드 | 규칙 |
| --- | --- |
| `name` | 필수, 3~50자 |
| `key` | 필수, `^[a-z][a-z0-9-]{2,19}$`, 중복 불가(서버 검증) |
| `description` | 선택 |
| `purpose` | 필수, enum `dev` `test` `prod` |
| `owner` | 필수, 사용자. 기본값은 신청자 |
| `members[]` | 객체 배열 `{user, role}`, role은 enum `admin` `developer` `viewer` |
| `approvers[]` | 필수, 이메일 1개 이상. 신청자 본인은 불가. 전원 승인이 필요하다 |

- 중첩(객체 배열)이 있어 elicitation을 쓰지 않고 폼 링크로만 진행한다.
- **승인은 N개의 병렬 승인이다.** 신청자가 `approvers[]`에 지정한 사용자 각각이 승인 1건을 갖는다. 순서는 없다.
  - 모든 승인이 `APPROVED`가 되면 신청이 `APPROVED`가 된다. 한 명이라도 `REJECTED`하면 신청이 `REJECTED`가 되고 남은 승인은 무효 처리한다.
  - 승인 1건의 상태: `PENDING | APPROVED | REJECTED`.
  - 별도의 admin 단계는 두지 않는다.
- **사용자는 식별자(이메일) 문자열만 받는다.** 사용자 테이블과 검색은 만들지 않는다. 형식만 검증한다. 승인 시점에 토큰의 이메일 클레임과 지정된 승인자를 대조한다. 오타로 지정하면 승인이 대기에 머무르므로, 신청자가 취소 후 재신청한다(승인자 교체는 후속).
- **신청 상태:** `DRAFT → IN_APPROVAL → APPROVED | REJECTED`, 신청자는 `CANCELED` 가능.
- 승인자 행위는 새 포트 `RequestApproval`(`approve`, `reject`)로 둔다. 승인은 사람의 결정이므로 MCP에는 노출하지 않는다.
- 지정 승인자 확인은 요청 데이터 기준이라 `domain`이 한다. Casbin은 `requester → project.create: read, draft, submit`처럼 유형별 행위 권한만 판정한다.

### 추가 미정

- [ ] 폼 URL의 기준 주소
- [ ] 승인자 식별자로 쓸 토큰 클레임(이메일 권장)과 대소문자 정규화
- [ ] 오타 승인자 대응(승인자 교체 기능을 언제 넣을지)
- [ ] 사용자 검색과 조직 계층 기반 자동 지정(후속)
- [ ] 승인 알림 방식과 승인 화면 범위
- [ ] 프로젝트 `key` 중복 검증 시점(draft 시 안내, 제출 시 확정)

## 구현 범위와 테스트 전략

저장소에는 Gradle 멀티모듈(`ingestion`, Spring Boot 4.0.7)과 `compose.yaml`(postgres, minio)이 있고, 사용자용 서비스 모듈은 아직 없다. 새 Gradle 모듈 `console`을 추가한다. 웹(SPA)은 이번 범위가 아니다.

**구현에 포함하는 것**

1. **CI 통합 테스트: 테스트 안에서 JWT 서명.** 테스트용 RSA 키로 `iss`, `aud`, `email`, `groups` 클레임을 서명하고, 테스트 프로필의 `JwtDecoder`가 공개키로 검증한다. 검증 항목:
   - `aud` 불일치는 거부된다.
   - 같은 사용자의 REST 호출과 MCP 호출이 같은 Casbin 판정을 받는다.
   - 승인자 이메일 대조가 동작한다.
   - 권한이 없으면 404다.
   - 필요하면 Spring Security Test의 `jwt()` 후처리기를 서비스 권한 테스트에 병행한다.
2. **로컬 e2e: Keycloak를 `compose.yaml`에 추가.** `start-dev`(내장 H2, 필요하면 `KC_DB=dev-mem`)와 `--import-realm` realm JSON(클라이언트, 이메일·groups 클레임 매퍼, 테스트 사용자)으로 구성한다. Claude Code 연결과 DCR 흐름을 확인하는 용도다. 익명 DCR 등록 정책(`localhost`)과 `aud` 매퍼 설정이 필요할 수 있다.

**구현에서 제외(수동 확인):** 사내 IdP의 DCR·`aud`·클레임 호환. Keycloak 통과가 사내 IdP 동작을 보증하지 않는다.

**버전 제안 (Maven Central 메타데이터·POM 확인, 2026-11-02, 빌드 검증 전)**

| 라이브러리 | 제안 | 근거 |
| --- | --- | --- |
| Spring Boot | 4.1.2, `console`만 적용 (저장소는 4.0.7, 4.0.9도 있음) | Modulith 2.1.2와 `mcp-server-security` 0.1.14가 Boot 4.1 계열(Security 7.1) 기준 |
| Spring Modulith | 2.1.2 | 2.0.x는 Boot 4.0.0 기준, 2.1.2는 Boot 4.1.2 기준 |
| Spring AI | 2.0.2 (`spring-ai-starter-mcp-server-webmvc`) | 2차 자료상 Boot 4.0.x·4.1.x 지원. 공식 문서 미확인, 아티팩트 이름이 1.x와 다를 수 있음 |
| `mcp-server-security` | 0.1.14 | Security 7.1.0, `mcp-core` 2.0.0 의존. 0.1.8은 Security 7.0.2, `mcp-core` 1.1.0 |
| jCasbin | 1.99.0 | 1.100은 스냅샷뿐 |
| jdbc-adapter | 2.13.0 | jcasbin 1.85.1 의존(Gradle이 상향). Oracle·MSSQL·MySQL 드라이버 제외 |

- `mcp-server-security` 0.1.14와 Spring AI 2.0.2가 서로 맞는지는 POM만으로 확정할 수 없다. 의존 해석으로 확인한다.
