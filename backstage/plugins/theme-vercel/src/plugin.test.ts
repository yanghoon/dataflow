import {
  themeVercelPlugin,
  themeVercelModule,
  vercelLightThemeExtension,
  vercelDarkThemeExtension,
} from './plugin';
import { vercelLightTheme, vercelDarkTheme } from './theme';

describe('themeVercelPlugin', () => {
  it('should export the theme plugin and module with light and dark extensions', () => {
    expect(themeVercelPlugin).toBeDefined();
    expect(themeVercelPlugin.id).toBe('theme-vercel');
    expect(themeVercelModule).toBeDefined();
    expect(vercelLightThemeExtension).toBeDefined();
    expect(vercelDarkThemeExtension).toBeDefined();
  });

  it('should configure vercelLightTheme correctly', () => {
    expect(vercelLightTheme).toBeDefined();
    const v4Theme = vercelLightTheme.getTheme('v4');
    expect(v4Theme).toBeDefined();
    expect(v4Theme?.typography.fontFamily).toContain('Geist Sans');
    expect(v4Theme?.palette.background.default).toBe('#FFFFFF');
  });

  it('should configure vercelDarkTheme correctly', () => {
    expect(vercelDarkTheme).toBeDefined();
    const v4Theme = vercelDarkTheme.getTheme('v4');
    expect(v4Theme).toBeDefined();
    expect(v4Theme?.typography.fontFamily).toContain('Geist Sans');
    expect(v4Theme?.palette.background.default).toBe('#000000');
  });
});
