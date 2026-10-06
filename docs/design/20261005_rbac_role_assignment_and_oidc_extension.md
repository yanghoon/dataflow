# Backstage 기본 RBAC 기반 사용자/역할(admin, manager, user) 할당 및 OIDC 확장 상세 설계 스펙

## 1. 개요 및 목표

### 1.1 목표
- Backstage 표준 RBAC 플러그인(`@backstage-community/plugin-rbac-backend` + Casbin)을 도입하여 **`admin`**, **`manager`**, **`user`** 3단계 역할(Role) 및 팀(Group) 체계를 구축한다.
- **app-config 최대 활용 + CSV 최소화** 원칙을 적용하여, `admin`은 `app-config.yaml`의 `admin.users` 설정만으로 자동 처리하고, `manager`/`user`는 최소 행의 `rbac-policy.csv`로 단순화한다.
- 개발/테스트 시 게스트(`user:development/guest`)의 역할을 CSV의 단 1줄 수정으로 전환하여 실제 권한 제어를 즉각 검증할 수 있도록 구성한다.
- 향후 필요 시 UI에서 역할을 수정할 수 있도록, 역할 편집 권한(`policy.entity.*`)을 CSV 내에 주석으로 사전 준비한다.
- 향후 OIDC(OpenID Connect) 도입 시, Auth SignIn Resolver에서 토큰에 `ent` 클레임(`[userEntityRef, groupEntityRef...]`)만 매핑하면 RBAC 정책 수정 없이 그대로 권한이 계승되도록 설계한다.

---

## 2. 권한 매트릭스 (Permission Matrix)

| 구분 | 대상 리소스 / 권한명 | Action | `admin` | `manager` | `user` |
|---|---|---|:---:|:---:|:---:|
| **Catalog** | `catalog.entity.read` | read | ✅ Allow | ✅ Allow | ✅ Allow |
| | `catalog.entity.create` | create | ✅ Allow | ✅ Allow | ❌ Deny |
| | `catalog.entity.delete` | delete | ✅ Allow | ❌ Deny | ❌ Deny |
| **TechDocs** | `techdocs.read` | read | ✅ Allow | ✅ Allow | ✅ Allow |
| **Platform Sites** | `platform.sites.read` | read | ✅ Allow | ✅ Allow | ❌ Deny |
| | `platform.sites.toolbindings.read` | read | ✅ Allow | ✅ Allow | ❌ Deny |
| | `platform.sites.toolbindings.update` | update | ✅ Allow | ✅ Allow | ❌ Deny |
| **Spring Batch** | `batch.job.read` | read | ✅ Allow | ✅ Allow | ✅ Allow |
| | `batch.job.execute` | create | ✅ Allow | ✅ Allow | ❌ Deny |
| | `batch.job.stop` | update/delete | ✅ Allow | ✅ Allow | ❌ Deny |
| **RBAC 정책** | `policy.entity.read` | read | ✅ Allow | ❌ Deny (옵션) | ❌ Deny (옵션) |
| | `policy.entity.update` | update | ✅ Allow | ❌ Deny (옵션) | ❌ Deny (옵션) |
| | `policy.entity.create/delete` | create/delete | ✅ Allow | ❌ Deny | ❌ Deny |

> *참고*: `manager`와 `user`의 RBAC 정책 편집 권한(`policy.entity.read/update`)은 `rbac-policy.csv` 내에 주석 처리되어 있으며, UI 테스트 필요 시 주석을 해제하여 즉시 Allow로 변경할 수 있습니다.

---

## 3. 구현 대상 및 구체적 코드 변경 명세

### 3.1 패키지 설치
백엔드에 커뮤니티 RBAC 플러그인을 설치합니다. (프론트엔드 `@backstage-community/plugin-rbac`은 이미 설치되어 있음)

```bash
yarn --cwd packages/backend add @backstage-community/plugin-rbac-backend
```

---

### 3.2 백엔드 등록: `packages/backend/src/index.ts`
기존 임시 모듈(`permissionPolicy`, `rbacSpringBridge`)을 제거하고 공식 RBAC 백엔드 플러그인으로 교체합니다.

```typescript
// packages/backend/src/index.ts

// [기존 코드 제거]
// backend.add(import('./modules/permissionPolicy'));
// backend.add(import('./modules/rbacSpringBridge'));

// [신규 추가: 표준 RBAC 백엔드 플러그인 등록]
backend.add(import('@backstage-community/plugin-rbac-backend'));
```

---

### 3.3 프론트엔드 플러그인 등록: `packages/app/src/App.tsx`
Declarative New Frontend System에 RBAC 프론트엔드 플러그인을 등록합니다.

```typescript
// packages/app/src/App.tsx
import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import rbacPlugin from '@backstage-community/plugin-rbac'; // 신규 추가
import { navModule } from './modules/nav';

import { springBatchFrontendPlugin } from '@jikwan/backstage-plugin-spring-batch-dashboard/src';
import platformAdminPlugin from '@internal/plugin-platform-admin';
import batchConsolePlugin from '@internal/backstage-plugin-batch-console';
import { themeVercelPlugin, themeVercelModule } from '@internal/backstage-plugin-theme-vercel';

export default createApp({
  features: [
    catalogPlugin,
    rbacPlugin, // 신규 추가
    navModule,
    springBatchFrontendPlugin,
    platformAdminPlugin,
    batchConsolePlugin,
    themeVercelPlugin,
    themeVercelModule,
  ],
});
```

---

### 3.4 사이드바 네비게이션 메뉴 연동: `packages/app/src/modules/nav/Sidebar.tsx`
RBAC 관리 페이지(`/rbac`)를 관리자 메뉴로 추가하고, 권한에 따라 표시/숨김 처리합니다.

```tsx
// packages/app/src/modules/nav/Sidebar.tsx
import SecurityIcon from '@material-ui/icons/Security';
import { policyEntityReadPermission } from '@backstage-community/plugin-rbac-common';

// ... (Sidebar 컴포넌트 내부의 Navigation 항목 렌더링 영역)

{/* OPERATIONS 또는 ADMINISTRATION SECTION */}
<RequirePermission permission={policyEntityReadPermission} errorPage={<></>}>
  <VercelSidebarItem
    to="/rbac"
    icon={SecurityIcon}
    text="Role Management"
  />
</RequirePermission>
```

---

## 4. 설정 파일 상세 명세

### 4.1 `backstage/app-config.yaml`
`admin` 역할 및 권한 프레임워크 설정:
```yaml
permission:
  enabled: true
  rbac:
    # 1. 최고 관리자 (슈퍼 어드민) 지정 - 별도 CSV 없이 모든 권한 자동 부여
    admin:
      users:
        - name: user:development/guest       # 기본 Guest 계정 (필요 시 주석 조정)
        - name: user:default/admin           # 어드민 유저
        - name: group:default/admin-team     # 어드민 팀
    # 2. 정적 정책 CSV 파일 경로
    policies-csv-file: ./rbac-policy.csv
    # 3. 파일 변경 시 핫 리로드 (서버 재시작 없이 즉시 반영)
    policyFileReload: true
    # 4. 데이터베이스 동기화 주기 (ms 단위)
    database-sync-interval: 60000
```

---

### 4.2 `backstage/rbac-policy.csv`
`manager`와 `user` 전용 권한 정책 및 그룹/테스트 바인딩:
```csv
# ==============================================================================
# 1. 권한 정책 정의 (p)
# Format: p, <roleEntityRef>, <permissionName>, <action>, <allow|deny>
# ==============================================================================
# [Manager 권한]
p, role:default/manager, catalog.entity.read, read, allow
p, role:default/manager, platform.sites.read, read, allow
p, role:default/manager, platform.sites.toolbindings.read, read, allow
p, role:default/manager, platform.sites.toolbindings.update, update, allow
p, role:default/manager, batch.job.read, read, allow
p, role:default/manager, batch.job.execute, create, allow

# [User 권한]
p, role:default/user, catalog.entity.read, read, allow
p, role:default/user, techdocs.read, read, allow
p, role:default/user, batch.job.read, read, allow

# [옵션: UI에서 롤을 직접 편집/할당하고 싶을 때 아래 4줄 주석 해제]
# p, role:default/manager, policy.entity.read, read, allow
# p, role:default/manager, policy.entity.update, update, allow
# p, role:default/user, policy.entity.read, read, allow
# p, role:default/user, policy.entity.update, update, allow

# ==============================================================================
# 2. 팀(Group) 및 고정 사용자 롤 할당 (g)
# Format: g, <userEntityRef | groupEntityRef>, <roleEntityRef>
# ==============================================================================
g, group:default/manager-team, role:default/manager
g, user:default/manager, role:default/manager
g, group:default/user-team, role:default/user
g, user:default/user, role:default/user

# ==============================================================================
# 3. 로컬 테스트용 Guest 롤 스위칭 (아래 중 1줄만 활성화하여 테스트)
# ==============================================================================
# [A] Manager 권한 테스트 시 활성화:
g, user:development/guest, role:default/manager

# [B] User 권한 테스트 시 활성화 (위 줄 주석 처리 후 아래 주석 해제):
# g, user:development/guest, role:default/user

# [C] Admin 권한 테스트 시: 위 두 줄 모두 주석 처리
# (app-config.yaml의 admin.users에 guest가 포함되어 자동 Admin 부여)
```

---

### 4.3 `backstage/examples/org.yaml`
테스트 및 카탈로그 기본 데이터:
```yaml
---
# ==============================================================================
# 팀 (Group) 정의
# ==============================================================================
apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: admin-team
  title: Platform Admin Team
spec:
  type: team
  children: []
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: manager-team
  title: Service Operations Team
spec:
  type: team
  children: []
---
apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: user-team
  title: General Engineering Team
spec:
  type: team
  children: []
---
# ==============================================================================
# 사용자 (User) 정의
# ==============================================================================
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: guest
spec:
  memberOf: [admin-team]
---
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: admin
spec:
  memberOf: [admin-team]
---
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: manager
spec:
  memberOf: [manager-team]
---
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: user
spec:
  memberOf: [user-team]
```

---

## 5. 단계별 테스트 및 자가검증 시나리오

| 테스트 케이스 | 설정 방법 | 기대 결과 |
|---|---|---|
| **Case 1: Admin 권한 검증** | `rbac-policy.csv` 3번 섹션 주석 처리 (Admin 모드) | 1. 사이드바에 `Role Management`(`/rbac`) 메뉴 노출<br/>2. Tool Bindings, Spring Batch, Catalog 등 모든 메뉴 및 생성/수정 가능<br/>3. `/rbac` 페이지 진입 및 역할 목록 정상 조회 |
| **Case 2: Manager 권한 검증** | `rbac-policy.csv`에 `g, user:development/guest, role:default/manager` 활성화 | 1. 사이드바에 Tool Bindings 및 Spring Batch 메뉴 노출<br/>2. 사이드바에서 `Role Management`(`/rbac`) 메뉴 자동 숨김<br/>3. 배치 작업 실행 가능 |
| **Case 3: User 권한 검증** | `rbac-policy.csv`에 `g, user:development/guest, role:default/user` 활성화 | 1. 사이드바에서 `Role Management`, `Tool Bindings` 메뉴 모두 숨김<br/>2. Catalog 및 TechDocs, Batch 상태 조회만 가능<br/>3. Tool Bindings 페이지 직접 URL 접근 시 접근 거부(Deny) |
| **Case 4: UI 편집 권한 검증** | `rbac-policy.csv`의 `policy.entity.*` 주석 4줄 해제 | 1. Manager/User 상태에서도 사이드바에 `Role Management` 메뉴 노출<br/>2. UI에서 직접 멤버 추가/제거 가능 |

---

## 6. 향후 OIDC 확장 시 구체적 적용 가이드

향후 Keycloak, Okta 등 OIDC를 도입할 때 RBAC 설정은 전혀 바꿀 필요가 없으며, 백엔드 Auth Provider 모듈 설정에 다음 Resolver 코드만 추가합니다.

### 6.1 SignIn Resolver 구현 예시
```typescript
// packages/backend/src/modules/authOidcModule.ts (향후 작성될 예시 코드)
import { createBackendModule } from '@backstage/backend-plugin-api';
import { oidcAuthenticator } from '@backstage/plugin-auth-backend-module-oidc-provider';
import { authProvidersExtensionPoint } from '@backstage/plugin-auth-node';

export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'oidc-provider-custom-signin',
  register(reg) {
    reg.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'oidc',
          factory: oidcAuthenticator({
            async signIn({ result, profile }, ctx) {
              const username = profile.email?.split('@')[0] || result.userinfo.sub;
              const userEntityRef = `user:default/${username}`;
              
              // 1. OIDC Token Claim에서 소속 그룹 추출 (예: IDP의 groups 클레임)
              const idpGroups: string[] = result.userinfo.groups || [];
              
              // 2. Backstage EntityRef 규격으로 변환
              const groupEntityRefs = idpGroups.map(g => `group:default/${g}`);

              // 3. Backstage Session Token 발행 (ent 클레임에 User 및 Group 주입)
              return ctx.issueToken({
                claims: {
                  sub: userEntityRef,
                  ent: [userEntityRef, ...groupEntityRefs],
                },
              });
            },
          }),
        });
      },
    });
  },
});
```
- OIDC 토큰의 `groups`가 `['admin-team']`이면 자동으로 `admin` 권한 획득.
- OIDC 토큰의 `groups`가 `['manager-team']`이면 자동으로 `manager` 권한 획득.
- OIDC 토큰의 `groups`가 `['user-team']`이면 자동으로 `user` 권한 획득.

---

## 7. 완료 판정 체크리스트
- [x] 권한 매트릭스(Catalog, Docs, Sites, Batch, RBAC) 정의 완료
- [x] 백엔드 패키지 설치 명령어 및 `index.ts` 등록 코드 명시
- [x] 프론트엔드 `App.tsx` 플러그인 등록 및 `Sidebar.tsx` 메뉴 바인딩 코드 명시
- [x] `app-config.yaml`, `rbac-policy.csv`, `org.yaml` 3개 설정의 완전한 코드 스니펫 작성
- [x] Guest 기반 1줄 스위칭 자가검증 테스트 시나리오(Admin, Manager, User) 확정
- [x] OIDC 확장 시 `SignInResolver` 코드 패턴 및 무중단 전환 원리 수립
