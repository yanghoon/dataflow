import { createUnifiedTheme, UnifiedTheme } from '@backstage/theme';
import './fonts';
import { vercelLightPalette, vercelDarkPalette } from './palette';
import { vercelTypography } from './typography';
import { vercelPageThemes, vercelDarkPageThemes } from './pageTheme';
import { vercelComponentOverrides, vercelDarkComponentOverrides } from './components';

export { geistTokens } from './tokens';

export const vercelLightTheme: UnifiedTheme = createUnifiedTheme({
  palette: vercelLightPalette as any,
  typography: vercelTypography,
  defaultPageTheme: 'home',
  pageTheme: vercelPageThemes,
  fontFamily: vercelTypography.fontFamily,
  components: vercelComponentOverrides as any,
});

export const vercelDarkTheme: UnifiedTheme = createUnifiedTheme({
  palette: vercelDarkPalette as any,
  typography: vercelTypography,
  defaultPageTheme: 'home',
  pageTheme: vercelDarkPageThemes,
  fontFamily: vercelTypography.fontFamily,
  components: vercelDarkComponentOverrides as any,
});
