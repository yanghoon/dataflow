import { useState, useMemo } from 'react';
import type { QuickDateRange } from '../components/common/DateRangeSelector';

interface UseDateRangeOptions {
  defaultDays?: number; // Default: last N days
}

interface UseDateRangeResult {
  fromDate: string;
  toDate: string;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  handleQuickSelect: (range: QuickDateRange) => void;
  fromISO: string; // ISO timestamp for API (00:00:00)
  toISO: string; // ISO timestamp for API (23:59:59)
}

/**
 * Hook for managing date range state
 */
export function useDateRange(
  options: UseDateRangeOptions = {},
): UseDateRangeResult {
  const { defaultDays = 7 } = options;

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultFrom = useMemo(
    () =>
      new Date(Date.now() - defaultDays * 86400000).toISOString().split('T')[0],
    [defaultDays],
  );

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(today);

  const handleQuickSelect = (range: QuickDateRange) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    switch (range) {
      case 'today':
        setFromDate(todayStr);
        setToDate(todayStr);
        break;
      case 'yesterday': {
        const yesterdayStr = new Date(now.getTime() - 86400000)
          .toISOString()
          .split('T')[0];
        setFromDate(yesterdayStr);
        setToDate(yesterdayStr);
        break;
      }
      case 'last7days': {
        const last7Str = new Date(now.getTime() - 7 * 86400000)
          .toISOString()
          .split('T')[0];
        setFromDate(last7Str);
        setToDate(todayStr);
        break;
      }
      case 'last30days': {
        const last30Str = new Date(now.getTime() - 30 * 86400000)
          .toISOString()
          .split('T')[0];
        setFromDate(last30Str);
        setToDate(todayStr);
        break;
      }
    }
  };

  // ISO timestamps for API calls
  const fromISO = fromDate ? `${fromDate}T00:00:00Z` : '';
  const toISO = toDate ? `${toDate}T23:59:59Z` : '';

  return {
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    handleQuickSelect,
    fromISO,
    toISO,
  };
}
