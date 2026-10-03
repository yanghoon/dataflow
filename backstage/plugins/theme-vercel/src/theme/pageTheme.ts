import { PageTheme } from '@backstage/theme';

const vercelFlatLightPageTheme: PageTheme = {
  colors: ['#FFFFFF', '#FFFFFF'],
  shape: 'none',
  backgroundImage: 'none',
  fontColor: '#000000',
};

const vercelFlatDarkPageTheme: PageTheme = {
  colors: ['#000000', '#000000'],
  shape: 'none',
  backgroundImage: 'none',
  fontColor: '#FFFFFF',
};

export const vercelPageThemes: Record<string, PageTheme> = {
  home: vercelFlatLightPageTheme,
  documentation: vercelFlatLightPageTheme,
  tool: vercelFlatLightPageTheme,
  service: vercelFlatLightPageTheme,
  website: vercelFlatLightPageTheme,
  library: vercelFlatLightPageTheme,
  other: vercelFlatLightPageTheme,
  app: vercelFlatLightPageTheme,
  apis: vercelFlatLightPageTheme,
  card: vercelFlatLightPageTheme,
};

export const vercelDarkPageThemes: Record<string, PageTheme> = {
  home: vercelFlatDarkPageTheme,
  documentation: vercelFlatDarkPageTheme,
  tool: vercelFlatDarkPageTheme,
  service: vercelFlatDarkPageTheme,
  website: vercelFlatDarkPageTheme,
  library: vercelFlatDarkPageTheme,
  other: vercelFlatDarkPageTheme,
  app: vercelFlatDarkPageTheme,
  apis: vercelFlatDarkPageTheme,
  card: vercelFlatDarkPageTheme,
};
