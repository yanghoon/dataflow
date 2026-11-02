# Spring MCP 서버·REST·인가 설계

2026-11-02 · @Hoon

## 상태와 요약

**상태:** Proposed (검토용). [0001](0001-hybrid-request-ux-architecture.md)의 "백엔드 MCP 도구 서버"와 "인가(OPA)" 부분을 구체화하고 대체한다.

**결정:**

- Flue는 MCP 서버를 제공하지 않는다(0001 확인). 그래서 MCP 서버는 백엔드와 같은 언어인 Spring으로 구현한다.
- 앱은 하나로 배포하고, Spring Modulith로 `domain`, `rest`, `mcp` 모듈을 나눈다.
- 인증은 Spring Security OAuth2 Resource Server(OIDC JWT 검증)를 설정 위주로 구성한다.
- 인가는 Casbin을 `domain`이 쓰는 한 벌로 둔다. OPA는 쓰지 않는다.

## 모듈 구조

| 모듈 | 역할 | 의존 |
| --- | --- | --- |
| `domain` | 비즈니스 데이터, 업무 로직, 스키마 검증, 권한 판정(Casbin), 감사. 애플리케이션 서비스 인터페이스(포트)를 공개한다 | 없음 |
| `rest` | 웹 BFF용 REST 컨트롤러. 포트 호출과 DTO 변환만 한다 | `domain` |
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

## 다음 단계

1. REST API 상세 설계(리소스, 요청, 응답, 오류, 권한 `resource` 이름)
2. MCP 도구 상세 설계(도구 목록, 입력 스키마, 포트 매핑, elicitation 가능 여부)
3. Casbin 모델과 초기 정책

## 상세 설계 (신청 1건 흐름)

흐름은 `신청서 목록 → 스키마 조회 → 임시저장(draft) → 제출 → 내 이력`이다. 제출은 웹 폼에서만 한다(0001: 채팅은 보조). 외부 에이전트가 MCP로 직접 제출하는 것은 초기에 허용하지 않고, 승인 정책이 정해지면 연다.

### 포트 (`domain` 공개 인터페이스)

| 포트 | 메서드 | REST | MCP |
| --- | --- | --- | --- |
| `RequestCatalog` | `listTypes()`, `getSchema(type)` | O | O |
| `RequestDrafts` | `create(type, data)`, `update(id, data)` | O | O (생성만) |
| `RequestSubmission` | `submit(draftId)` | O | **X** |
| `RequestHistory` | `listMine()`, `get(id)` | O | O |

### REST (`rest` 모듈)

| 메서드 · 경로 | 포트 | Casbin 리소스 · 행위 |
| --- | --- | --- |
| `GET /api/request-types` | `listTypes` | 유형별 `request-type:{type}` · `read`로 필터링 |
| `GET /api/request-types/{type}/schema` | `getSchema` | `request-type:{type}` · `read` |
| `POST /api/requests/drafts` | `create` | `request-type:{type}` · `draft` |
| `PUT /api/requests/drafts/{id}` | `update` | 소유자 확인 후 `draft` |
| `POST /api/requests/{id}/submit` | `submit` | `request-type:{type}` · `submit`, 스키마 전체 검증 |
| `GET /api/requests`, `GET /api/requests/{id}` | `listMine`, `get` | 본인 것만 |

- 오류: 400은 필드별 검증 오류 목록, 403은 권한 없음, 404는 없음. 존재 여부를 숨겨야 하는 남의 신청은 404로 답한다.
- 소유권(본인 것만)은 Casbin 정책이 아니라 `domain` 서비스가 `owner == sub`로 확인한다.

### MCP 도구 (`mcp` 모듈, 제출 도구 없음)

| 도구 | 포트 | 비고 |
| --- | --- | --- |
| `list_request_types` | `listTypes` | 권한 있는 유형만 |
| `get_request_schema` | `getSchema` | JSON Schema 반환 |
| `create_request_draft` | `create` | 반환: `draftId`와 웹 폼 URL. 사용자가 폼에서 확인하고 제출한다 |
| `list_my_requests`, `get_request` | `listMine`, `get` | 읽기 전용 |

- 도구 입력 스키마는 `getSchema`가 주는 신청 스키마를 재사용한다. 도구 오류는 REST와 같은 메시지를 `isError`로 돌려준다.
- 중첩 스키마는 elicitation(평면·원시 타입만 허용)을 쓰지 않고 폼 링크를 반환한다.

### 추가 미정

- [ ] draft 검증 강도(부분 허용 vs 전체 검증)와 만료 기간
- [ ] 폼 URL의 기준 주소와 draft 열람 권한
- [ ] 제출 멱등성(중복 제출 방지 키)
- [ ] 신청 유형 목록과 유형별 Casbin 정책 초기값
