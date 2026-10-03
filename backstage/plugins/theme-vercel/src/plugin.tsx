import { createFrontendPlugin, createFrontendModule } from '@backstage/frontend-plugin-api';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { UnifiedThemeProvider } from '@backstage/theme';
import { vercelLightTheme, vercelDarkTheme } from './theme';

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

export const vercelDarkThemeExtension = ThemeBlueprint.make({
  name: 'vercel-dark',
  params: {
    theme: {
      id: 'vercel-dark',
      title: 'Vercel Dark',
      variant: 'dark',
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={vercelDarkTheme}>
          {children}
        </UnifiedThemeProvider>
      ),
    },
  },
});

export const themeVercelModule = createFrontendModule({
  pluginId: 'app',
  extensions: [vercelLightThemeExtension, vercelDarkThemeExtension],
});

export const themeVercelPlugin = createFrontendPlugin({
  pluginId: 'theme-vercel',
  extensions: [vercelLightThemeExtension, vercelDarkThemeExtension],
});
