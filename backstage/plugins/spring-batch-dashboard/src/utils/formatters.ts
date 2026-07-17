import type { Environment } from '../types';

/**
 * Date formatting utility
 */
export const formatDate = (date: Date | string | null): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US');
};

/**
 * Duration formatting utility
 * Accepts either milliseconds or start/end dates
 */
export const formatDuration = (
  startOrMs: Date | string | number | null,
  end?: Date | string | null,
): string => {
  let ms: number;

  // If second parameter is provided, calculate duration from start and end
  if (end !== undefined) {
    if (!startOrMs || !end) return 'N/A';
    ms = new Date(end).getTime() - new Date(startOrMs).getTime();
  } else {
    // Single parameter is treated as milliseconds
    if (startOrMs === null || startOrMs === undefined) return 'N/A';
    ms = typeof startOrMs === 'number' ? startOrMs : 0;
  }

  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

/**
 * Date formatting utility (displays DB time as-is without timezone conversion)
 * Backend now returns formatted strings, so just pass through
 * @param date - Date string from backend (already formatted as 'yyyy-MM-dd HH:mm:ss')
 * @param _environment - Current environment (unused, kept for compatibility)
 * @returns Formatted date string in 'yyyy-MM-dd HH:mm:ss' format (DB raw value)
 */
export const formatDateWithTimezone = (
  date: Date | string | null,
  _environment?: Environment,
): string => {
  if (!date) return 'N/A';

  // Backend now returns strings in 'YYYY-MM-DD HH24:MI:SS' format
  // Just return as-is (true DB raw value, no timezone conversion)
  return typeof date === 'string' ? date : String(date);
};
