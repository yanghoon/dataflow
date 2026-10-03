import { Overrides } from '@material-ui/core/styles/overrides';
import { FONT_FAMILY_SANS } from './fonts';

export const vercelComponentOverrides: Overrides & Record<string, any> = {
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
  BackstageSidebar: {
    drawer: {
      backgroundColor: '#FFFFFF',
      borderRight: '1px solid #EAEAEA',
      width: '240px !important',
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

export const vercelLightComponentOverrides = vercelComponentOverrides;

export const vercelDarkComponentOverrides: Overrides & Record<string, any> = {
  MuiCssBaseline: {
    '@global': {
      html: {
        fontFamily: FONT_FAMILY_SANS,
      },
      body: {
        fontFamily: FONT_FAMILY_SANS,
        backgroundColor: '#000000',
        color: '#FFFFFF',
      },
    },
  },
  MuiPaper: {
    elevation0: {
      border: '1px solid rgba(255, 255, 255, 0.12)',
      backgroundColor: '#0A0A0A',
    },
    elevation1: {
      boxShadow: 'none',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      backgroundColor: '#0A0A0A',
    },
    elevation2: {
      boxShadow: 'none',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      backgroundColor: '#0A0A0A',
    },
    rounded: {
      borderRadius: 6,
    },
  },
  MuiCard: {
    root: {
      boxShadow: 'none !important',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: 6,
      backgroundColor: '#0A0A0A',
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
      backgroundColor: '#FFFFFF',
      color: '#000000',
      '&:hover': {
        backgroundColor: '#EDEDED',
      },
    },
    outlined: {
      borderColor: 'rgba(255, 255, 255, 0.14)',
      color: '#EDEDED',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: '#FFFFFF',
      },
    },
  },
  MuiTableHead: {
    root: {
      backgroundColor: '#0A0A0A',
      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    },
  },
  MuiTableCell: {
    root: {
      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
      fontSize: '0.875rem',
      padding: '12px 16px',
      color: '#EDEDED',
    },
    head: {
      fontWeight: 500,
      color: '#A1A1A1',
      backgroundColor: '#0A0A0A',
      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    },
  },
  MuiTableRow: {
    root: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.05) !important',
      },
    },
  },
  MuiTabs: {
    indicator: {
      backgroundColor: '#FFFFFF',
      height: 2,
    },
  },
  MuiTab: {
    root: {
      textTransform: 'none',
      fontWeight: 500,
      minWidth: 'auto',
      padding: '8px 16px',
      color: '#A1A1A1',
      '&:hover': {
        color: '#FFFFFF',
      },
    },
    selected: {
      color: '#FFFFFF !important',
      fontWeight: 600,
    },
  },
  MuiChip: {
    root: {
      borderRadius: 4,
      border: '1px solid rgba(255, 255, 255, 0.12)',
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      color: '#EDEDED',
      fontWeight: 500,
    },
  },
  BackstageHeader: {
    header: {
      backgroundImage: 'none !important',
      backgroundColor: '#000000 !important',
      boxShadow: 'none !important',
      borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
      color: '#FFFFFF !important',
      padding: '24px 32px',
    },
    title: {
      color: '#FFFFFF !important',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    subtitle: {
      color: '#A1A1A1 !important',
    },
    type: {
      color: '#707070 !important',
      textTransform: 'uppercase',
      fontWeight: 600,
    },
  },
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
  BackstageSidebar: {
    drawer: {
      backgroundColor: '#000000',
      borderRight: '1px solid rgba(255, 255, 255, 0.10)',
      width: '240px !important',
    },
  },
  BackstageSidebarItem: {
    root: {
      color: '#A1A1A1',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: '#FFFFFF',
      },
    },
    selected: {
      backgroundColor: 'rgba(255, 255, 255, 0.08) !important',
      color: '#FFFFFF !important',
      fontWeight: 600,
    },
  },
};
