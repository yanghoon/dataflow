# Vercel 스타일 Backstage 커스텀 테마 플러그인 설계 스펙

## 목표
(요구사항 원문)
- vercel 스타일의 backstage 커스텀 테마 개발
- 라이트 모드 우선 구현 (`vercel-light`)
- Settings(사용자 설정) 화면에서 선택 가능한 추가 테마 옵션으로 등록
- 폰트는 `@fontsource/geist-sans`, `@fontsource/geist-mono`를 통해 로컬 번들링
- B 타입 스코프 적용: Palette(Monochrome) + Typography(Geist) + 공통 컴포넌트(Header, Sidebar, Tabs, Card, Table, Button, Status Badge, Layout 전면 Vercel 스타일 오버라이드)
- 개별 플러그인이나 Backstage 코어는 절대 건드리지 않고, 테마 플러그인 설정 후 테마 스위칭 시 즉시 전체 화면에 반영되도록 구현
- 테마 플러그인 방식의 기술적 실현 가능성(Feasibility) 검증 완료 후 진행
- 디자인 문서에 관련 공식 문서 및 참고 링크를 타이틀과 함께 정확히 기재
- 구현 대상의 예상 위치와 구체적인 파일 및 스켈레톤 코드를 명세화

---

## 기술적 실현 가능성 (Feasibility) 검증 결과

Backstage의 New Frontend System (`@backstage/frontend-plugin-api`, `@backstage/plugin-app-react`, `@backstage/theme`) 구조 분석 결과, **개별 플러그인과 코어 코드를 전혀 건드리지 않고 독립 테마 플러그인만으로 100% 구현 가능함**을 확인하였습니다.

1. **테마 등록 메커니즘**:
   - Backstage New Frontend System에서는 `ThemeBlueprint.make({ name: 'vercel-light', params: { theme } })`를 통해 테마 익스텐션을 정의합니다.
   - `ThemeBlueprint`는 내부적으로 `{ id: 'api:app/app-theme', input: 'themes' }`에 자동 바인딩(attachTo)되므로, `createFrontendPlugin`에 익스텐션으로 등록하고 `packages/app/src/App.tsx`의 `features` 배열에 플러그인을 추가하는 것만으로 테마 등록이 완료됩니다.
2. **무중단 동적 테마 스위칭**:
   - `@backstage/plugin-user-settings`의 `UserSettingsThemeToggle`은 `appThemeApi.getInstalledThemes()`를 호출하여 등록된 모든 테마 목록을 렌더링합니다.
   - 사용자가 'Vercel Light'를 선택하면 `appThemeApi.setActiveThemeId('vercel-light')`가 호출되어 `activeThemeId$` Observable이 발행되고, App의 루트 `ThemeProvider`가 리액트 Context 수준에서 즉시 교체됩니다.
3. **전역 스타일 침투 (Global Style Cascade)**:
   - Backstage 코어 컴포넌트(`@backstage/core-components`: Header, Sidebar, Page, Table, Card 등)와 개별 기능 플러그인은 모두 Material-UI (`@material-ui/core`) 테마 컨텍스트(`useTheme`, `makeStyles`)를 공유합니다.
   - `createUnifiedTheme`의 `palette`, `typography`, `pageTheme`, `components` 오버라이드를 설정하면, 개별 플러그인의 코드를 일절 수정하지 않아도 모든 화면의 색상, 폰트, 테두리(border), 둥글기(radius), 헤더 배너 제거 등이 일괄 적용됩니다.

---

## 관련 참고 문서 및 공식 링크 (References)

1. **Vercel Brand Guidelines & Design Rules**
   - 링크: [https://www.ui-skills.com/design-md/vercel](https://www.ui-skills.com/design-md/vercel)
   - 타이틀: *Design report websites like Vercel - UI Skills*
   - 핵심 지침: 모노크롬 중심, 장식성 그라디언트/배경 패턴 배제, 일관된 Geist 폰트 체계, 4~6px 반경, 미세한 경계선(`--vbg-border-subtle`)
2. **shadcn/ui Vercel Design System**
   - 링크: [https://www.shadcn.io/design/vercel](https://www.shadcn.io/design/vercel)
   - 타이틀: *Vercel Theme & Design System - shadcn/ui*
   - 핵심 지침: Radix Grayscale 기반의 팔레트, 미니멀한 카드/테이블 여백, 컴팩트한 인라인 컨트롤
3. **Backstage New Frontend System: App Themes**
   - 링크: [https://backstage.io/docs/frontend-system/building-apps/app-themes](https://backstage.io/docs/frontend-system/building-apps/app-themes)
   - 타이틀: *App Themes | Backstage Software Catalog and Developer Platform*
   - 핵심 규격: New Frontend System에서의 `ThemeBlueprint` 및 `appThemeApi` 익스텐션 등록 규격
4. **Backstage Custom Themes Architecture**
   - 링크: [https://backstage.io/docs/getting-started/app-custom-theme](https://backstage.io/docs/getting-started/app-custom-theme)
   - 타이틀: *Customize the look-and-feel of your App | Backstage Software Catalog and Developer Platform*
   - 핵심 규격: `createUnifiedTheme`, `genPageTheme`, MUI v4/v5 컴포넌트 오버라이드 기법
5. **Fontsource: Geist Sans Typeface**
   - 링크: [https://fontsource.org/fonts/geist-sans](https://fontsource.org/fonts/geist-sans)
   - 타이틀: *Geist Sans - Fontsource*
   - 번들링: `@fontsource/geist-sans` (Weights: 400, 500, 600)
6. **Fontsource: Geist Mono Typeface**
   - 링크: [https://fontsource.org/fonts/geist-mono](https://fontsource.org/fonts/geist-mono)
   - 타이틀: *Geist Mono - Fontsource*
   - 번들링: `@fontsource/geist-mono` (Weights: 400, 500)
7. **Vercel Official Geist Font Documentation**
   - 링크: [https://vercel.com/font](https://vercel.com/font)
   - 타이틀: *Geist - Vercel Font*

---

## 구현 대상 명세 (Target File Specifications)

### 전체 파일 및 위치 구조

```text
backstage/
├── plugins/
│   └── theme-vercel/                               # [신규] Vercel 테마 독립 플러그인
│       ├── package.json                            # 플러그인 패키지 매니페스트
│       ├── tsconfig.json                           # TypeScript 설정
│       ├── src/
│       │   ├── index.ts                            # 플러그인 공개 엔트리포인트
│       │   ├── plugin.ts                           # Frontend Plugin & Theme Extension 정의
│       │   ├── plugin.test.ts                      # 테마 익스텐션 단위 테스트
│       │   └── theme/
│       │       ├── index.ts                        # vercelLightTheme UnifiedTheme 인스턴스
│       │       ├── fonts.ts                        # @fontsource 로컬 폰트 임포트
│       │       ├── palette.ts                      # Vercel Monochrome 팔레트
│       │       ├── typography.ts                   # Geist Sans / Mono 타이포그래피 계층
│       │       ├── pageTheme.ts                    # 헤더 배너/그라디언트 제거 및 단색 플랫화
│       │       └── components.ts                   # Header, Sidebar, Card, Table 등 컴포넌트 오버라이드
└── packages/
    └── app/
        ├── package.json                            # [수정] @internal/backstage-plugin-theme-vercel 의존성 추가
        └── src/
            └── App.tsx                             # [수정] features에 themeVercelPlugin 1줄 추가
```

---

### 상세 파일별 예상 코드 및 스펙

#### 1. `backstage/plugins/theme-vercel/package.json` (신규)
플러그인 매니페스트 및 자체 완결형 의존성 정의.
```json
{
  "name": "@internal/backstage-plugin-theme-vercel",
  "version": "0.1.0",
  "license": "UNLICENSED",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "publishConfig": {
    "access": "public",
    "main": "dist/index.esm.js",
    "types": "dist/index.d.ts"
  },
  "backstage": {
    "role": "frontend-plugin",
    "pluginId": "theme-vercel"
  },
  "sideEffects": [
    "**/*.css"
  ],
  "scripts": {
    "start": "backstage-cli package start",
    "build": "backstage-cli package build",
    "lint": "backstage-cli package lint",
    "test": "backstage-cli package test",
    "clean": "backstage-cli package clean"
  },
  "dependencies": {
    "@backstage/core-plugin-api": "^1.12.8",
    "@backstage/frontend-plugin-api": "^0.17.3",
    "@backstage/plugin-app-react": "^0.2.5",
    "@backstage/theme": "^0.7.3",
    "@fontsource/geist-sans": "^5.3.0",
    "@fontsource/geist-mono": "^5.0.3",
    "@material-ui/core": "^4.12.2"
  },
  "peerDependencies": {
    "react": "^16.13.1 || ^17.0.0 || ^18.0.0"
  },
  "devDependencies": {
    "@backstage/cli": "^0.36.4",
    "@backstage/frontend-test-utils": "^0.6.2",
    "@testing-library/react": "^14.0.0",
    "react": "^18.0.2"
  },
  "files": [
    "dist"
  ]
}
```

---

#### 2. `backstage/plugins/theme-vercel/src/theme/fonts.ts` (신규)
외부 CDN 의존성을 제거하고 로컬 NPM 번들을 통해 Geist 폰트를 전역 로딩.
```typescript
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';

export const FONT_FAMILY_SANS =
  "'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const FONT_FAMILY_MONO =
  "'Geist Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
```

---

#### 3. `backstage/plugins/theme-vercel/src/theme/palette.ts` (신규)
Vercel 브랜드 특유의 화이트/블랙/서틀 그레이 기반 모노크롬 팔레트 정의.
```typescript
import { BuiltinPaletteType } from '@backstage/theme';

export const vercelLightPalette: BuiltinPaletteType = {
  type: 'light',
  mode: 'light',
  background: {
    default: '#FFFFFF',
    paper: '#FFFFFF',
  },
  status: {
    ok: '#0070F3',
    warning: '#F5A623',
    error: '#EE0000',
    running: '#0070F3',
    pending: '#888888',
    aborted: '#888888',
  },
  bursts: {
    fontColor: '#FFFFFF',
    slackChannelText: '#666666',
    backgroundColor: {
      default: '#000000',
    },
    gradient: {
      linear: 'linear-gradient(90deg, #000000 0%, #333333 100%)',
    },
  },
  primary: {
    main: '#000000',
    light: '#333333',
    dark: '#000000',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#666666',
    light: '#888888',
    dark: '#000000',
    contrastText: '#FFFFFF',
  },
  banner: {
    info: '#000000',
    error: '#EE0000',
    text: '#FFFFFF',
    link: '#FFFFFF',
    closeButtonColor: '#FFFFFF',
    warning: '#F5A623',
  },
  border: '#EAEAEA',
  textContrast: '#000000',
  textVerySubtle: '#888888',
  textSubtle: '#666666',
  highlight: '#FAFAFA',
  errorBackground: '#FDF2F2',
  warningBackground: '#FFFBEB',
  infoBackground: '#F0F9FF',
  errorText: '#EE0000',
  infoText: '#0070F3',
  warningText: '#F5A623',
  linkHover: '#000000',
  link: '#0070F3',
  gold: '#F5A623',
  navigation: {
    background: '#FFFFFF',
    indicator: '#000000',
    color: '#666666',
    selectedColor: '#000000',
    navItem: {
      hoverBackground: '#F5F5F5',
    },
    submenu: {
      background: '#FFFFFF',
    },
  },
  pinSidebarButton: {
    icon: '#000000',
    background: '#EAEAEA',
  },
  tabbar: {
    indicator: '#000000',
  },
};
```

---

#### 4. `backstage/plugins/theme-vercel/src/theme/typography.ts` (신규)
Geist Sans 및 Geist Mono를 기반으로 한 일관된 타이포그래피 계층.
```typescript
import { BackstageTypography } from '@backstage/theme';
import { FONT_FAMILY_SANS } from './fonts';

export const vercelTypography: BackstageTypography = {
  fontFamily: FONT_FAMILY_SANS,
  htmlFontSize: 16,
  h1: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: '-0.025em',
    color: '#000000',
  },
  h2: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.02em',
    color: '#000000',
  },
  h3: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.02em',
    color: '#000000',
  },
  h4: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.015em',
    color: '#000000',
  },
  h5: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.45,
    letterSpacing: '-0.01em',
    color: '#000000',
  },
  h6: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: '-0.01em',
    color: '#000000',
  },
  body1: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '0.875rem',
    lineHeight: 1.5,
    color: '#000000',
  },
  body2: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    color: '#666666',
  },
  button: {
    fontFamily: FONT_FAMILY_SANS,
    fontWeight: 500,
    fontSize: '0.875rem',
    textTransform: 'none',
  },
  caption: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '0.75rem',
    lineHeight: 1.4,
    color: '#888888',
  },
  overline: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
};
```

---

#### 5. `backstage/plugins/theme-vercel/src/theme/pageTheme.ts` (신규)
Backstage 기본의 컬러풀한 파도/그라디언트 배경(`pageTheme`)을 완전히 지우고, Vercel 특유의 단일 캔버스(Flat White)로 통일.
```typescript
import { PageTheme } from '@backstage/theme';

const vercelFlatPageTheme: PageTheme = {
  colors: ['#FFFFFF', '#FFFFFF'],
  shape: 'none',
  backgroundImage: 'none',
  fontColor: '#000000',
};

export const vercelPageThemes: Record<string, PageTheme> = {
  home: vercelFlatPageTheme,
  documentation: vercelFlatPageTheme,
  tool: vercelFlatPageTheme,
  service: vercelFlatPageTheme,
  website: vercelFlatPageTheme,
  library: vercelFlatPageTheme,
  other: vercelFlatPageTheme,
  app: vercelFlatPageTheme,
  apis: vercelFlatPageTheme,
  card: vercelFlatPageTheme,
};
```

---

#### 6. `backstage/plugins/theme-vercel/src/theme/components.ts` (신규)
Header, Sidebar, Card, Table, Tabs, Button, Chip 등 전면 컴포넌트 오버라이드.
```typescript
import { Overrides } from '@material-ui/core/styles/overrides';
import { FONT_FAMILY_SANS } from './fonts';

export const vercelComponentOverrides: Overrides = {
  MuiCssBaseline: {
    '@global': {
      html: {
        fontFamily: FONT_FAMILY_SANS,
      },
      body: {
        fontFamily: FONT_FAMILY_SANS,
        backgroundColor: '#FFFFFF',
        color: '#000000',
      },
    },
  },
  MuiPaper: {
    elevation0: {
      border: '1px solid #EAEAEA',
    },
    elevation1: {
      boxShadow: 'none',
      border: '1px solid #EAEAEA',
    },
    elevation2: {
      boxShadow: 'none',
      border: '1px solid #EAEAEA',
    },
    rounded: {
      borderRadius: 6,
    },
  },
  MuiCard: {
    root: {
      boxShadow: 'none !important',
      border: '1px solid #EAEAEA',
      borderRadius: 6,
    },
  },
  MuiButton: {
    root: {
      borderRadius: 6,
      textTransform: 'none',
      fontWeight: 500,
      boxShadow: 'none !important',
    },
    containedPrimary: {
      backgroundColor: '#000000',
      color: '#FFFFFF',
      '&:hover': {
        backgroundColor: '#333333',
      },
    },
    outlined: {
      borderColor: '#EAEAEA',
      '&:hover': {
        backgroundColor: '#F5F5F5',
        borderColor: '#000000',
      },
    },
  },
  MuiTableHead: {
    root: {
      backgroundColor: '#FAFAFA',
      borderBottom: '1px solid #EAEAEA',
    },
  },
  MuiTableCell: {
    root: {
      borderBottom: '1px solid #EAEAEA',
      fontSize: '0.875rem',
      padding: '12px 16px',
    },
    head: {
      fontWeight: 500,
      color: '#666666',
      backgroundColor: '#FAFAFA',
      borderBottom: '1px solid #EAEAEA',
    },
  },
  MuiTableRow: {
    root: {
      '&:hover': {
        backgroundColor: '#FAFAFA !important',
      },
    },
  },
  MuiTabs: {
    indicator: {
      backgroundColor: '#000000',
      height: 2,
    },
  },
  MuiTab: {
    root: {
      textTransform: 'none',
      fontWeight: 500,
      minWidth: 'auto',
      padding: '8px 16px',
      '&:hover': {
        color: '#000000',
      },
    },
    selected: {
      color: '#000000 !important',
      fontWeight: 600,
    },
  },
  MuiChip: {
    root: {
      borderRadius: 4,
      border: '1px solid #EAEAEA',
      backgroundColor: '#FAFAFA',
      fontWeight: 500,
    },
  },
  // Backstage 특화 컴포넌트 오버라이드
  BackstageHeader: {
    header: {
      backgroundImage: 'none !important',
      backgroundColor: '#FFFFFF !important',
      boxShadow: 'none !important',
      borderBottom: '1px solid #EAEAEA',
      color: '#000000 !important',
      padding: '24px 32px',
    },
    title: {
      color: '#000000 !important',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    subtitle: {
      color: '#666666 !important',
    },
    type: {
      color: '#888888 !important',
      textTransform: 'uppercase',
      fontWeight: 600,
    },
  },
  BackstageSidebar: {
    drawer: {
      backgroundColor: '#FFFFFF',
      borderRight: '1px solid #EAEAEA',
    },
  },
  BackstageSidebarItem: {
    root: {
      color: '#666666',
      '&:hover': {
        backgroundColor: '#F5F5F5',
        color: '#000000',
      },
    },
    selected: {
      backgroundColor: '#F5F5F5 !important',
      color: '#000000 !important',
      fontWeight: 600,
    },
  },
};
```

---

#### 7. `backstage/plugins/theme-vercel/src/theme/index.ts` (신규)
`createUnifiedTheme`를 호출하여 UnifiedTheme 인스턴스 조립.
```typescript
import { createUnifiedTheme, UnifiedTheme } from '@backstage/theme';
import './fonts';
import { vercelLightPalette } from './palette';
import { vercelTypography } from './typography';
import { vercelPageThemes } from './pageTheme';
import { vercelComponentOverrides } from './components';

export const vercelLightTheme: UnifiedTheme = createUnifiedTheme({
  palette: vercelLightPalette as any,
  typography: vercelTypography,
  defaultPageTheme: 'home',
  pageTheme: vercelPageThemes,
  fontFamily: vercelTypography.fontFamily,
  components: vercelComponentOverrides as any,
});
```

---

#### 8. `backstage/plugins/theme-vercel/src/plugin.ts` (신규)
Backstage New Frontend System에 테마 익스텐션 및 플러그인 등록.
```typescript
import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { UnifiedThemeProvider } from '@backstage/theme';
import { vercelLightTheme } from './theme';

export const vercelLightThemeExtension = ThemeBlueprint.make({
  name: 'vercel-light',
  params: {
    theme: {
      id: 'vercel-light',
      title: 'Vercel Light',
      variant: 'light',
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={vercelLightTheme}>
          {children}
        </UnifiedThemeProvider>
      ),
    },
  },
});

export const themeVercelPlugin = createFrontendPlugin({
  pluginId: 'theme-vercel',
  extensions: [vercelLightThemeExtension],
});
```

---

#### 9. `backstage/plugins/theme-vercel/src/index.ts` (신규)
패키지 최상단 엔트리포인트 export.
```typescript
export { themeVercelPlugin, vercelLightThemeExtension } from './plugin';
export { vercelLightTheme } from './theme';
```

---

#### 10. `backstage/plugins/theme-vercel/src/plugin.test.ts` (신규)
테마 익스텐션 등록 및 테마 속성 무결성 단위 테스트.
```typescript
import { themeVercelPlugin, vercelLightThemeExtension } from './plugin';
import { vercelLightTheme } from './theme';

describe('themeVercelPlugin', () => {
  it('should export the theme plugin with vercel-light extension', () => {
    expect(themeVercelPlugin).toBeDefined();
    expect(themeVercelPlugin.id).toBe('theme-vercel');
    expect(vercelLightThemeExtension).toBeDefined();
  });

  it('should configure vercelLightTheme correctly', () => {
    expect(vercelLightTheme).toBeDefined();
    const v4Theme = vercelLightTheme.getTheme('v4');
    expect(v4Theme).toBeDefined();
    expect(v4Theme?.typography.fontFamily).toContain('Geist Sans');
    expect(v4Theme?.palette.background.default).toBe('#FFFFFF');
  });
});
```

---

#### 11. `backstage/packages/app/package.json` (수정)
워크스페이스 의존성 등록 (단 1줄 추가):
```diff
   "dependencies": {
+    "@internal/backstage-plugin-theme-vercel": "workspace:^",
     "@internal/backstage-plugin-batch-console": "workspace:^",
     "@internal/backstage-plugin-settings": "workspace:^",
```

---

#### 12. `backstage/packages/app/src/App.tsx` (수정)
앱 진입점에 플러그인 등록 (단 2줄 추가):
```diff
 import catalogPlugin from '@backstage/plugin-catalog/alpha';
 import { navModule } from './modules/nav';
 
 import { springBatchFrontendPlugin } from '@jikwan/backstage-plugin-spring-batch-dashboard/src';
 import platformAdminPlugin from '@internal/plugin-platform-admin';
 import batchConsolePlugin from '@internal/backstage-plugin-batch-console';
+import { themeVercelPlugin } from '@internal/backstage-plugin-theme-vercel';
 
 export default createApp({
   features: [
     catalogPlugin, navModule,
     springBatchFrontendPlugin,
     platformAdminPlugin,
     batchConsolePlugin,
+    themeVercelPlugin,
   ],
 });
```

---

## 완료 조건 (자가검증)
- [ ] 의존성 설치 및 TypeScript 컴파일 통과 (`yarn tsc`)
- [ ] 테마 플러그인 패키지 빌드 성공 (`yarn backstage-cli package build`)
- [ ] 단위 테스트 통과 (`yarn backstage-cli package test` in `plugins/theme-vercel`)
- [ ] 런타임 검증:
  - Settings 화면(`/settings` 또는 User Profile)의 테마 선택기(Theme Toggle)에 `Vercel Light` 옵션이 표시되는가?
  - `Vercel Light` 선택 시 헤더 배너 그라디언트가 사라지고, Geist 폰트 및 모노크롬 플랫 카드 스타일이 즉시 적용되는가?
  - 기존 다른 화면(Catalog, Settings, Batch Console 등)의 기능이 온전히 유지되는가?

---

## 미결 사항
- 없음 (라이트 모드, B타입 스코프, 플러그인 분리, 폰트 번들링, 파일별 상세 코드 명세 완료)
