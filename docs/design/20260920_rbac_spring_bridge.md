# RBAC Spring Boot 연동 브릿지 설계 스펙

## 목표
- 권한 판단 로직은 Spring Boot(단일 진실 공급원)가 통제하되, 관리 화면(UX)은 공식 컴포넌트(`@backstage-community/plugin-rbac`)를 재사용하여 개발 비용을 최소화한다.
- 공식 RBAC 백엔드 플러그인(`@backstage-community/plugin-rbac-backend`) 대신, 프론트엔드가 호출하는 관리 API(`/api/permission/...`)를 가로채어 Spring Boot로 프록시(전달)하는 커스텀 브릿지 모듈(`rbacSpringBridge`)을 구현한다.

## 배경 / 기존 컨텍스트
- **참조한 기존 패턴**: Backstage의 커스텀 백엔드 모듈(`createBackendModule`)과 HTTP 라우터 확장을 이용한 API 프록시 패턴.
- **신규로 가는 이유 (기존 걸로 안 되는 이유)**: 공식 `plugin-rbac-backend`를 그대로 사용하면 RBAC 데이터 모델(권한, 역할 등)이 Backstage 로컬 데이터베이스에 갇히게 되고, 권한 판정의 주도권(Source of Truth)이 분산됨. Spring Boot로 모든 권한 판단을 일원화하기 위해 직접 연결이 필요함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | 해당 없음 | 동기식 REST API 프록시 호출이므로 상태 비저장(stateless) 원칙을 따름. |
| 동시성 제어 | **Optimistic Locking** (`version` 컬럼 활용) | Last-write-wins 방식은 관리자 간 서로의 변경 사항을 덮어써 격리 사고로 이어질 수 있음. Permission 도메인은 실패를 명시적으로 드러내는 게 안전(fail-safe)하므로 불일치 시 `409 Conflict` 반환. |
| 실패/재시도 | **재시도 없이 즉시 원본 상태 코드 그대로 전달** (4xx/5xx 포함) | 브릿지가 비멱등(POST/PUT/DELETE) 요청을 임의로 재시도하면 중복 생성 및 의도치 않은 권한 부여 위험이 큼. 실패 처리는 사용자(관리자)의 판단에 위임. |
| 데이터 모델 | **Spring Boot 스키마 확정 (version 포함)** | `permission(name, action)`, `role(name, version)`, `role_permission(role_id, permission_id, action)`, `role_assignment(role_id, principal, scope_ref, version)` (브릿지는 JSON 구조 변경 없이 패스스루). |
| 파라미터 시간 결합 (절대/상대, 계산 위치) | 해당 없음 | 단순 실시간 CRUD 프록시이므로 시간 스케줄링이나 시간 계산 파라미터 없음. |
| 책임 범위 | **이번 스코프 = CRUD 프록시 기능으로 제한** | `/authorize`에 대한 실시간 판정(CompositePolicy) 로직은 역할과 호출 빈도가 완전히 다르므로, 별도의 모듈(`permission-backend` + Casbin)이 담당. |

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트: 브릿지 전용 로직 검증 (테스트 파일 분리)
  - `nock` 또는 `msw`로 Spring Boot API 응답 Mocking
  - 상태 코드 정상(Passthrough) 전달 검증 (2xx)
  - 409 Conflict 에러 정상 전파 검증
  - 타임아웃/네트워크 오류 발생 시 500/502 반환 검증
- [ ] 통합테스트: (이번 스코프 제외 - 실제 Spring Boot 더미 서버 구성 불필요)
- [ ] 커버리지 기준: 80% (일반 브릿지 로직 기준)

## 미결 사항
- 409 발생 시 사용자에게 원인을 명확히 보여주는 **커스텀 에러 배너**를 RBAC 화면 위에 얹을지 여부 (공식 컴포넌트의 한계로 인해 별도의 커스터마이징 결정 필요). 현재는 Network 탭 확인 안내로 갈음.
