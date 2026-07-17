/**
 * Menu props for Select dropdowns to ensure consistent dropdown behavior
 */
export const SELECT_MENU_PROPS = {
  anchorOrigin: {
    vertical: 'bottom' as const,
    horizontal: 'left' as const,
  },
  transformOrigin: {
    vertical: 'top' as const,
    horizontal: 'left' as const,
  },
  PaperProps: {
    sx: {
      '& .MuiList-root': {
        display: 'flex',
        flexDirection: 'column',
      },
    },
  },
};

/**
 * Environment display labels (fallback)
 * These labels will be used if no custom label is provided
 */
export function getEnvironmentLabel(environment: string): string {
  const labelMap: Record<string, string> = {
    dev: 'Dev',
    development: 'Development',
    qa: 'QA',
    staging: 'Staging',
    'prd-virginia': 'PRD Virginia',
    'prd-seoul': 'PRD Seoul',
    production: 'Production',
    prod: 'Production',
  };

  return labelMap[environment] || environment.toUpperCase();
}

/**
 * Toggle button group styles for environment selector
 */
export const ENVIRONMENT_TOGGLE_SX = {
  '& .MuiToggleButton-root': {
    px: 3,
    py: 1,
    fontWeight: 600,
    textTransform: 'none' as const,
    border: '1px solid',
    borderColor: 'divider',
    '&.Mui-selected': {
      backgroundColor: 'primary.main',
      color: 'primary.contrastText',
      borderColor: 'primary.main',
      '&:hover': {
        backgroundColor: 'primary.dark',
        borderColor: 'primary.dark',
      },
    },
  },
};

/**
 * Job statuses for filter dropdown
 */
export const JOB_STATUSES = [
  'COMPLETED',
  'FAILED',
  'STARTED',
  'STOPPED',
  'UNKNOWN',
] as const;

/**
 * Boot versions for filter dropdown
 */
export const BOOT_VERSIONS = ['Boot3', 'Boot4'] as const;

/**
 * Default pagination page size
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Available page sizes for pagination
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
