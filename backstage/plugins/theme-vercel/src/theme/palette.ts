import { BackstagePaletteOptions } from '@backstage/theme';

export const vercelLightPalette: BackstagePaletteOptions & { mode?: string } = {
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

export const vercelDarkPalette: BackstagePaletteOptions & { mode?: string } = {
  type: 'dark',
  mode: 'dark',
  background: {
    default: '#000000',
    paper: '#0A0A0A',
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
    slackChannelText: '#A1A1A1',
    backgroundColor: {
      default: '#000000',
    },
    gradient: {
      linear: 'linear-gradient(90deg, #111111 0%, #222222 100%)',
    },
  },
  primary: {
    main: '#FFFFFF',
    light: '#EDEDED',
    dark: '#CCCCCC',
    contrastText: '#000000',
  },
  secondary: {
    main: '#A1A1A1',
    light: '#CCCCCC',
    dark: '#707070',
    contrastText: '#000000',
  },
  banner: {
    info: '#111111',
    error: '#EE0000',
    text: '#FFFFFF',
    link: '#FFFFFF',
    closeButtonColor: '#FFFFFF',
    warning: '#F5A623',
  },
  border: 'rgba(255, 255, 255, 0.12)',
  textContrast: '#FFFFFF',
  textVerySubtle: '#707070',
  textSubtle: '#A1A1A1',
  highlight: '#111111',
  errorBackground: '#2A0000',
  warningBackground: '#2E1900',
  infoBackground: '#001A33',
  errorText: '#FF3333',
  infoText: '#0070F3',
  warningText: '#F5A623',
  linkHover: '#FFFFFF',
  link: '#0070F3',
  gold: '#F5A623',
  navigation: {
    background: '#000000',
    indicator: '#FFFFFF',
    color: '#A1A1A1',
    selectedColor: '#FFFFFF',
    navItem: {
      hoverBackground: 'rgba(255, 255, 255, 0.05)',
    },
    submenu: {
      background: '#0A0A0A',
    },
  },
  pinSidebarButton: {
    icon: '#FFFFFF',
    background: 'rgba(255, 255, 255, 0.14)',
  },
  tabbar: {
    indicator: '#FFFFFF',
  },
};
