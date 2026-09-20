# Platform Admin 권한 제어 및 상세 페이지 연동 설계 스펙

## 목표
- `platform-admin` 플러그인에 `SiteToolBindingsPage` (`/api/v1/sites/{slug}/toolbindings`)를 추가.
- Backstage Permission 프레임워크를 도입하여, 하드코딩된 사용자 역할(`site-admin`, `platform-admin`)에 따른 메뉴 및 페이지 접근 제어 적용.
- 추후 OIDC 기반 인증 연동을 고려한 플러그인 아키텍처 구성.

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: `@backstage/plugin-permission-*` 패키지를 활용한 Policy Backend Module 구성 및 프론트엔드의 `<RequirePermission>` 래퍼 사용.
- 신규로 가는 이유: 백엔드 API 권한 제어와 UI 메뉴 가시성을 일치시키고, 향후 OIDC 기반 엔터프라이즈 인증 시스템으로 유연하게 넘어가기 위한 기반(하드코딩 정책) 마련.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | N/A | 프론트엔드/인가 미들웨어의 단순 동작이므로 해당 없음 |
| 동시성 제어 | N/A | 권한 판별은 요청 단위 Stateless 처리 |
| 실패/재시도 | N/A (기본 ErrorBoundary/ErrorPage 사용) | Backstage 기본 UI 컴포넌트 정책 활용 |
| 데이터 모델 | `SiteToolBindings` 데이터 컬럼: `toolSlug`, `status` | 사용자가 제시한 최소 구성 템플릿 유지 |
| 파라미터 시간 결합 | 하드코딩된 `user:development/guest` 계정명 고정 | 로컬 개발 환경에서의 즉각적인 권한 분기 테스트 용이성 |
| 권한 구조 | `platform.tools.read`, `platform.sites.read`, `platform.sites.toolbindings.read` 분리 | 역할(`platform-admin`, `site-admin`)에 따른 세밀한 가시성 제어 |

## 완료 조건 (자가검증)
- [ ] 권한 관련 백엔드/프론트엔드 패키지(`@backstage/plugin-permission-*`) 설치 확인
- [ ] `plugins/platform-admin/src/permissions.ts` 파일 내 권한 객체 생성 확인
- [ ] 백엔드 패키지(`packages/backend/src/modules/permissionPolicy.ts`)에 `HardcodedPolicy` 등록 확인
- [ ] 신규 프론트엔드 페이지(`SiteToolBindingsPage.tsx`) 컴포넌트 생성 및 라우팅 연결
- [ ] `packages/app/src/modules/nav/Sidebar.tsx`에 권한별 조건부 메뉴(`RequirePermission`) 추가 확인
- [ ] `yarn dev` 컴파일 통과 및 빌드 성공 여부 검증
- [ ] 수동 검증: `ROLES` 설정을 `site-admin`으로 두었을 때 Tool Bindings 메뉴만 보이고, `platform-admin`으로 변경 시 모든 메뉴가 보이는지 체크

## 미결 사항
- 추후 OIDC 연동 시점 및 세부 Claim(그룹/역할) 매핑 로직은 이번 스코프에서 제외 (이후 연동 작업 시 구체화)
