# Backstage Vercel Geist 테마 및 계층형 사이드바 UI 설계 스펙

## 목표
(요구사항 원문)
- Vercel의 Geist 디자인 철학(순수한 무채색, 높은 대비, 정교한 1px 보더, 마이크로 인터랙션)을 기반으로 Spotify Backstage의 고유 IA(Information Architecture)를 재구성한 사이드바 설계.
- 기존 Backstage의 두꺼운 아이콘 레일(Rail, 72px) 방식 대신, Vercel 대시보드 형태의 고정 너비 계층형 사이드바(240px)로 전환.
- Atom 단위 스타일 스펙(Design Tokens): 다크 모드 및 라이트 모드 듀얼 모드 토큰 지원, 정교한 1px 구분선(Divider/Border) 사양 준수.
- Backstage Theme React/CSS-in-JS(MUI v4 `styled`/`makeStyles`) 기반 스타일 정의 및 마이크로 인터랙션(120ms 트랜지션, 인셋 테두리 등) 반영.
- 백스테이지 테마 및 스타일 공식 아키텍처 준수, 기존 시스템의 기능(Catalog, Scaffolder, Spring Batch, Platform Admin 등)과 최대한 정합성 유지.
- 개별 플러그인이나 화면은 절대 건드리지 않고, 테마 플러그인 및 네비게이션 모듈 레벨에서 완벽히 수용.

---

## 배경 및 기존 컨텍스트

### 1. 기존 구현 상태 분석
- **Backstage 버전 및 프론트엔드 시스템**: `@backstage/frontend-defaults: ^0.5.4` 기반 New Frontend System (`@backstage/frontend-plugin-api: ^0.17.3`, `@backstage/plugin-app-react: ^0.2.5`), Material-UI v4 (`@material-ui/core: ^4.12.2`).
- **네비게이션 모듈 위치**: `packages/app/src/modules/nav/`에서 `NavContentBlueprint.make(...)`를 통해 `app/nav` 익스텐션을 등록하여 사이드바를 구성 중.
- **기존 테마 플러그인**: `plugins/theme-vercel/`에 `vercelLightTheme`이 등록되어 있으나, 기존 사이드바는 `@backstage/core-components`의 레일형 `Sidebar`(열림 224px / 닫힘 72px)를 그대로 사용 중이며 다크 모드 테마가 부재함.
- **Backstage 레이아웃 연동 특성**:
  - New Frontend System의 `AppLayout`은 `<SidebarPage>` 컨테이너로 Nav와 Content를 감쌉니다.
  - `SidebarPage`는 기본적으로 `props.isPinned ? sidebarConfig.drawerWidthOpen(224px) : sidebarConfig.drawerWidthClosed(72px)`를 메인 컨텐츠 영역의 `paddingLeft`로 설정합니다.
  - 따라서 240px 고정 사이드바로 전환 시 메인 컨텐츠 영역과 오버랩이 발생하지 않도록 `BackstageSidebarPage` 컴포넌트의 테마 오버라이드(`paddingLeft: 240px !important`)를 반드시 함께 적용해야 합니다.

### 2. 신규 설계의 차별성 (기존 방식으로 불가능한 이유)
- 기본 Backstage `<Sidebar>`는 72px 아이콘 레일(Rail)과 핀 고정 토글에 강하게 결합되어 있어, Geist 특유의 고밀도 텍스트 계층형 IA(Section Header + 13px Label + 16px Icon + Inset Border) 표현이 불가능합니다.
- 이에 따라 `NavContentBlueprint` 내에서 Vercel 대시보드 규격의 전용 240px 고정 컨테이너와 계층형 아이템 컴포넌트를 구성하고, 테마 플러그인에서 다크/라이트 토큰 및 글로벌 레이아웃 오버라이드를 제공하도록 설계합니다.

---

## 정보 구조(IA) 및 레이아웃 명세

### 1. 사이드바 와이어프레임 및 계층 구조
```text
+------------------------------------------+
| [Logo] Acme Portal           [Org Switch]|  <- Header / Workspace (36px)
+------------------------------------------+
| [ 🔍 Search resources...             ⌘K ]|  <- Quick Command Palette Button (32px)
+------------------------------------------+
| PLATFORM                                 |  <- Section Header (11px Uppercase)
|  ├ [Box] Software Catalog                |  <- Nav Item (34px, 13px Text, 16px Icon)
|  └ [PlusSquare] Create (Templates)       |
|                                          |
| OPERATIONS                               |  <- Section Header
|  ├ [Schedule] Spring Batch               |
|  ├ [Build] Platform Tools (RBAC)         |
|  ├ [Web] Platform Sites (RBAC)           |
|  └ [Extension] Tool Bindings (RBAC)      |
|                                          |
| OTHER EXTENSIONS (Live Auto-discovered)  |  <- nav.rest() 스크롤 영역
|  └ [Dynamic] Plugins ...                 |
+------------------------------------------+
|  [Bell] Notifications         [Badge]    |  <- Sticky Bottom Dock
|  [Sliders] Settings                      |
|  [Avatar] Hoon Yang           [ThemeIco] |  <- User Profile & Theme Switch (36px)
+------------------------------------------+
```

### 2. Backstage 실제 설치 플러그인 매핑
| 그룹 (Section) | 메뉴 명칭 | 라우트 경로 | 권한/가드 (Permission Guard) | 아이콘 (16px) |
|---|---|---|---|---|
| **Header** | Acme Portal (Workspace) | `/` | 없음 | Backstage Logo / Workspace Mark |
| **Search** | Quick Command Palette | Dialog Trigger | 없음 | Search + `⌘K` Badge |
| **PLATFORM** | Software Catalog | `/catalog` | `page:catalog` | Box / Layers Icon |
| **PLATFORM** | Create (Templates) | `/create` | `page:scaffolder` | PlusSquare / AddBox Icon |
| **OPERATIONS** | Spring Batch | `/platform/batch/schedules` | 없음 | Schedule / Activity Icon |
| **OPERATIONS** | Platform Tools | `/platform-tools` | `toolsReadPermission` | Build / Sliders Icon |
| **OPERATIONS** | Platform Sites | `/platform-sites` | `sitesReadPermission` | Web / Globe Icon |
| **OPERATIONS** | Tool Bindings | `/platform-sites/default/toolbindings` | `siteToolBindingsReadPermission` | Extension / Cpu Icon |
| **OTHER** | Auto-discovered Apps | Dynamic (`nav.rest()`) | 각 플러그인 정의 | 플러그인 정의 아이콘 |
| **DOCK** | Notifications | `/notifications` | New Frontend Blueprint | Bell Icon + Counter Badge |
| **DOCK** | Settings | `/settings` | 없음 | Sliders / Cog Icon |
| **PROFILE** | User Profile & Theme Toggle | `/settings` | `identityApi`, `appThemeApi` | User Avatar + Sun/Moon Icon |

---

## Atom 단위 디자인 토큰 스펙 (Design Tokens)

### 1. Container & Layout Tokens
| 속성 (Property) | Vercel Dark Mode | Vercel Light Mode | 비고 |
|---|---|---|---|
| `width` | `240px` (고정) | `240px` (고정) | Collapse(Rail) 모드 비활성화 |
| `height` | `100vh` | `100vh` | 뷰포트 고정 높이 |
| `background` | `#000000` | `#FFFFFF` | 순수 무채색 단색 캔버스 |
| `border-right` | `1px solid rgba(255, 255, 255, 0.10)` | `1px solid #EAEAEA` | 메인 컨텐츠 영역과의 1px 분할선 |
| `padding` | `12px 8px` | `12px 8px` | 내부 패딩 |
| `display` / `flex-direction` | `flex`, `column` | `flex`, `column` | 상단 메뉴와 하단 독 간 분할 |

### 2. Divider / Border Tokens
| 용도 (Divider Role) | Dark Mode | Light Mode | 설명 |
|---|---|---|---|
| 사이드바 우측 경계선 | `rgba(255, 255, 255, 0.10)` (#1F1F1F) | `#EAEAEA` (rgba(0, 0, 0, 0.08)) | 사이드바 전체 우측 1px |
| 수평 분할선 (`<hr />`) | `rgba(255, 255, 255, 0.08)` (#1A1A1A) | `rgba(0, 0, 0, 0.06)` (#F0F0F0) | 헤더, 메뉴 그룹, 독 간 1px 구분 |
| Active 아이템 인셋 보더 | `rgba(255, 255, 255, 0.12)` | `rgba(0, 0, 0, 0.08)` (#E5E5E5) | 선택된 아이템의 1px inset 테두리 |
| 컨트롤/단축키 배지 외곽선 | `rgba(255, 255, 255, 0.14)` | `#EAEAEA` | 검색 인풋 및 `⌘K` Kbd 보더 |

### 3. Typography Tokens
- **Font Family**:
  - Sans: `'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - Mono: `'Geist Mono', Menlo, Monaco, Consolas, monospace`
- **Section Heading (Group Label)**:
  - Font Size: `11px`, Font Weight: `500`, Line Height: `16px`
  - Letter Spacing: `0.04em` (자간 확장), Text Transform: `uppercase`
  - Color: Dark `#707070` | Light `#666666`
  - Padding: `16px 8px 6px 8px`
- **Navigation Item Label**:
  - Font Size: `13px`, Line Height: `20px`, Letter Spacing: `-0.01em`
  - Font Weight: Default `400`, Active `500`

### 4. Navigation Item Component States
| 상태 (State) | Dark Mode Background | Dark Text/Icon | Light Mode Background | Light Text/Icon | Box Shadow / Border |
|---|---|---|---|---|---|
| **Default** | `transparent` | Text `#A1A1A1` / Icon `#8E8E8E` (1.5px) | `transparent` | Text `#666666` / Icon `#666666` (1.5px) | `none` |
| **Hover** | `rgba(255, 255, 255, 0.05)` | Text `#EDEDED` / Icon `#EDEDED` (1.5px) | `rgba(0, 0, 0, 0.04)` | Text `#171717` / Icon `#171717` (1.5px) | `none` |
| **Active** | `rgba(255, 255, 255, 0.08)` | Text `#FFFFFF` / Icon `#FFFFFF` (1.75px) | `rgba(0, 0, 0, 0.06)` | Text `#000000` / Icon `#000000` (1.75px) | `inset 0 0 0 1px` (Dark `rgba(255,255,255,0.12)`, Light `rgba(0,0,0,0.08)`) |
| **Focus-Visible** | `transparent` | Text/Icon `#FFFFFF` | `transparent` | Text/Icon `#000000` | `box-shadow: 0 0 0 2px #0070F3` |

- **Geometry & Transitions**:
  - `height: 34px`, `padding: 0 8px`, `border-radius: 6px`, `gap: 8px`
  - `transition: background 120ms ease, color 120ms ease, stroke 120ms ease`

### 5. Utility Atoms (Search, Kbd, Badge, Profile)
- **Search Command Bar Button**:
  - `height: 32px`, `padding: 0 8px`, `border-radius: 6px`
  - Dark: BG `rgba(255, 255, 255, 0.04)`, Border `1px solid rgba(255, 255, 255, 0.12)`, Color `#888888`
  - Light: BG `rgba(0, 0, 0, 0.02)`, Border `1px solid #EAEAEA`, Color `#888888`
  - Hover: Dark BG `rgba(255, 255, 255, 0.07)`, Light BG `rgba(0, 0, 0, 0.04)`
- **Kbd Atom (`⌘K`)**:
  - `height: 18px`, `padding: 0 4px`, `border-radius: 4px`, `font-size: 10px`, `font-family: 'Geist Mono'`
  - Dark: BG `rgba(255, 255, 255, 0.07)`, Border `1px solid rgba(255, 255, 255, 0.12)`, Color `#888888`
  - Light: BG `rgba(0, 0, 0, 0.04)`, Border `1px solid #EAEAEA`, Color `#666666`
- **Badge Atom (Counter / Tag)**:
  - `height: 18px`, `padding: 0 6px`, `border-radius: 9999px`, `font-size: 11px`, `font-weight: 500`
  - Dark: BG `rgba(255, 255, 255, 0.06)`, Color `#A1A1A1`
  - Light: BG `rgba(0, 0, 0, 0.05)`, Color `#444444`
- **User Profile Dock Atom**:
  - Avatar: `24px * 24px`, 둥근 테두리 (`border: 1px solid`, Dark `rgba(255,255,255,0.14)` / Light `#EAEAEA`)
  - User Name: `font-size: 13px`, `font-weight: 500`, Dark `#EDEDED` / Light `#171717`
  - Theme Switch Icon Button: `24px * 24px`, Dark `#8E8E8E` (Hover `#FFFFFF`) / Light `#666666` (Hover `#000000`)

---

## 구현 대상 상세 명세 (Target File Specifications)

### 1. 대상 파일 목록
| 대상 유형 | 파일 경로 | 클래스 / 컴포넌트명 | 주요 역할 및 설명 |
|---|---|---|---|
| **신규** | `backstage/packages/app/src/modules/nav/VercelSidebarItem.tsx` | `VercelSidebarItem` | Vercel Geist 규격 34px NavItem, Active 인셋 테두리 및 120ms 호버 인터랙션 |
| **신규** | `backstage/packages/app/src/modules/nav/SidebarSearchTrigger.tsx` | `SidebarSearchTrigger` | `⌘K` Kbd 단축키 배지 포함 검색 트리거 버튼, 클릭 시 Backstage 검색 모달 오픈 |
| **신규** | `backstage/packages/app/src/modules/nav/SidebarUserProfile.tsx` | `SidebarUserProfile` | 하단 고정 독(Sticky Dock): 아바타, 사용자 이름, 테마 즉시 스위칭 아이콘 버튼 |
| **수정** | `backstage/packages/app/src/modules/nav/SidebarLogo.tsx` | `SidebarLogo` | 240px 너비 맞춤 헤더: Acme Portal 타이틀 및 워크스페이스 마크 |
| **수정** | `backstage/packages/app/src/modules/nav/Sidebar.tsx` | `SidebarContent` | 기존 레일 제거, 240px 고정 Vercel 계층형 사이드바로 전면 재구성 |
| **신규** | `backstage/plugins/theme-vercel/src/theme/tokens.ts` | `geistTokens` | 다크/라이트 모드 공통 디자인 토큰 (Border, Background, Text, Geometry) |
| **수정** | `backstage/plugins/theme-vercel/src/theme/palette.ts` | `vercelDarkPalette`, `vercelLightPalette` | Vercel 순수 무채색 다크/라이트 팔레트 정의 |
| **수정** | `backstage/plugins/theme-vercel/src/theme/components.ts` | `vercelComponentOverrides` | `BackstageSidebarPage`의 `paddingLeft: 240px` 고정 및 Geist 스타일 오버라이드 |
| **수정** | `backstage/plugins/theme-vercel/src/theme/index.ts` | `vercelDarkTheme`, `vercelLightTheme` | 다크/라이트 UnifiedTheme 듀얼 인스턴스 빌드 |
| **수정** | `backstage/plugins/theme-vercel/src/plugin.tsx` | `vercelDarkThemeExtension`, `themeVercelPlugin` | `vercel-dark` 및 `vercel-light` 테마 New Frontend System 익스텐션 등록 |
| **수정** | `backstage/plugins/theme-vercel/src/index.ts` | 패키지 exports | 신규 테마 및 익스텐션 공개 export |

---

### 2. 컴포넌트별 상세 설계 및 인터페이스

#### (1) `VercelSidebarItem.tsx` (신규)
- React Router `NavLink` 기반의 커스텀 내비게이션 아이템.
- Material-UI `makeStyles` 또는 `styled`를 사용하여 테마 팔레트(`theme.palette.type === 'dark' ? ... : ...`)에 따라 실시간 색상 적응.
- Props:
  ```typescript
  export interface VercelSidebarItemProps {
    to: string;
    icon: React.ComponentType<{ className?: string }>;
    text: string;
    badge?: string | number;
  }
  ```

#### (2) `SidebarSearchTrigger.tsx` (신규)
- `<SidebarSearchModal>`을 내부에 트리거하는 가짜 인풋 버튼.
- 키보드 이벤트 리스너(`keydown`: `Meta+K` or `Ctrl+K`)를 등록하여 전역 어디서나 ⌘K 입력 시 검색 모달 오픈.

#### (3) `SidebarUserProfile.tsx` (신규)
- `@backstage/core-plugin-api`의 `identityApiRef`를 통해 로그인 사용자 프로필(DisplayName, PhotoUrl)을 렌더링.
- `appThemeApiRef`를 통해 현재 테마 ID(`vercel-dark` <-> `vercel-light`)를 1클릭 토글.

#### (4) `Sidebar.tsx` (수정)
- 전체 컨테이너를 `aside` 태그 기반의 240px 고정 뷰로 렌더링.
- 스크롤 가능 영역(`flex: 1`, `overflow-y: auto`)과 하단 고정 독 영역(`position: sticky`, `bottom: 0`) 분리.
- `navItems.take(...)`와 `navItems.rest(...)`를 모두 활용하여, 정의된 핵심 메뉴는 계층 구조(PLATFORM, OPERATIONS)에 정렬하고 추가 플러그인은 동적 수용.

#### (5) `plugins/theme-vercel/src/theme/components.ts` (수정)
- Backstage의 기본 레이아웃 패딩을 240px로 고정:
  ```typescript
  BackstageSidebarPage: {
    root: {
      '@media (min-width: 600px)': {
        paddingLeft: '240px !important',
      },
      '@media (max-width: 599.95px)': {
        paddingLeft: '0 !important',
      },
    },
  },
  ```

---

## 설계 결정 및 근거 (Design Decisions)

| 항목 | 결정 내용 | 기술적/아키텍처적 근거 |
|---|---|---|
| **레이아웃 연동** | `BackstageSidebarPage`의 `paddingLeft: 240px !important` 테마 오버라이드 적용 | Core 컴포넌트나 다른 플러그인의 수정 없이, 테마 플러그인의 MUI CSS 오버라이드만으로 240px 고정 사이드바와 메인 컨텐츠 영역의 완전한 정렬 보장 |
| **테마 모드 범위** | `vercel-light` 및 `vercel-dark` 듀얼 모드 지원 | Vercel의 순수 무채색 철학은 다크 모드에서 가장 극대화되며, 사용자가 제공한 다크/라이트 토큰을 단일 인터페이스(`geistTokens`)로 묶어 확장성 확보 |
| **메뉴 그룹화 (IA)** | PLATFORM (Catalog, Scaffolder) + OPERATIONS (Spring Batch, Admin) + Dynamic REST | 기존 시스템의 실제 플러그인을 온전히 보존하면서, Vercel 스타일의 계층형 가독성을 100% 충족 |
| **마이크로 인터랙션** | 120ms 트랜지션, 1px 인셋 테두리(`inset 0 0 0 1px`), 단축키 ⌘K 지원 | Vercel 대시보드의 실제 인터랙션 규격을 완벽하게 재현 |
| **플러그인 불변 원칙** | `theme-vercel` 및 `packages/app/src/modules/nav`로 변경 범위 제한 | 개별 비즈니스 플러그인(Spring Batch, Batch Console, Platform Admin 등)에는 일절 영향을 주지 않음 |

---

## 서브모듈 및 소비자 영향도 파악 (Cross-Module Impact)

- **소비 측 영향도**: 없음. 개별 플러그인 화면(Spring Batch, Batch Console, Settings, Catalog 등)의 컴포넌트나 라우팅 코드는 일절 변경되지 않습니다.
- **테마 전환 영향도**: 테마 스위칭 시 사이드바 배경 및 폰트, 보더 색상이 자동으로 연동되어 매끄럽게 전환됩니다.
- **반응형(모바일) 영향도**: 데스크톱(`>=600px`)에서는 고정 240px로 작동하며, 모바일 화면에서는 `paddingLeft: 0` 및 기본 모바일 내비게이션 동작을 방해하지 않도록 미디어 쿼리를 격리합니다.

---

## 완료 조건 (자가검증 체크리스트)

- [ ] **TypeScript 컴파일 검증**: `yarn tsc` 오류 없음
- [ ] **빌드 검증**: `yarn backstage-cli package build` in `plugins/theme-vercel` 및 `packages/app` 성공
- [ ] **단위 테스트**: `plugins/theme-vercel`의 다크/라이트 테마 인스턴스 검증 테스트 통과
- [ ] **UI 및 레이아웃 검증**:
  - 사이드바 너비가 정확히 `240px`로 고정되고, 메인 컨텐츠 영역과 오버랩이나 간격 오류가 없는가?
  - `PLATFORM`, `OPERATIONS` 섹션 헤더 및 아이템(Catalog, Spring Batch, Tools 등)이 지정된 토큰대로 렌더링되는가?
  - 검색 트리거 버튼 클릭 및 `⌘K` 입력 시 검색 다이얼로그가 정상 실행되는가?
  - 하단 독의 프로필 및 테마 전환 버튼이 정상 작동하며, `vercel-dark` / `vercel-light` 간 전환 시 120ms 내에 실시간 반영되는가?

---

## 미결 사항 (Open Issues)
- 없음 (위치, IA 그룹핑, 듀얼 테마 지원 범위, 240px 레이아웃 패딩 오버라이드 전략 합의 완료)
