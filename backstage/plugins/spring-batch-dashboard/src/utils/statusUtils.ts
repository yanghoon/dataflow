import type { JobStatus } from '../types';

/**
 * Get MUI color for job status chip
 */
export const getStatusColor = (
  status: JobStatus,
): 'default' | 'primary' | 'secondary' => {
  switch (status) {
    case 'COMPLETED':
      return 'primary';
    case 'FAILED':
      return 'secondary';
    case 'STARTED':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Get custom style for job status chip
 */
export const getStatusStyle = (status: JobStatus) => {
  switch (status) {
    case 'COMPLETED':
      return { backgroundColor: '#4caf50', color: 'white' };
    case 'FAILED':
      return { backgroundColor: '#f44336', color: 'white' };
    case 'STARTED':
      return { backgroundColor: '#2196f3', color: 'white' };
    default:
      return {};
  }
};

/**
 * Get border color for statistics cards
 */
export const getStatBorderColor = (
  type:
    | 'total'
    | 'completed'
    | 'failed'
    | 'running'
    | 'primary'
    | 'info'
    | 'secondary',
): string => {
  switch (type) {
    case 'total':
      return 'grey.500';
    case 'completed':
      return 'success.main';
    case 'failed':
      return 'error.main';
    case 'running':
      return 'info.main';
    case 'primary':
      return 'primary.main';
    case 'info':
      return 'info.main';
    case 'secondary':
      return 'secondary.main';
    default:
      return 'grey.500';
  }
};

/**
 * Get text color for statistics cards
 */
export const getStatTextColor = (
  type: 'total' | 'completed' | 'failed' | 'running' | 'default',
): string => {
  switch (type) {
    case 'completed':
      return '#4caf50';
    case 'failed':
      return '#f44336';
    case 'running':
      return '#2196f3';
    default:
      return 'inherit';
  }
};

/**
 * Get background color for boot version chip
 */
export const getBootVersionColor = (bootVersion: 'Boot3' | 'Boot4'): string => {
  return bootVersion === 'Boot3' ? 'info.main' : 'secondary.main';
};
