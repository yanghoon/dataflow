import { useState, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE } from '../utils';

interface UsePaginationOptions {
  defaultPageSize?: number;
}

interface PaginationState {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

interface PaginationControls {
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

interface PaginationResult<T> {
  state: PaginationState;
  controls: PaginationControls;
  paginatedData: T[];
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Hook for page-based pagination
 * Converts page/pageSize to offset/limit for API calls
 */
export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {},
): PaginationResult<T> {
  const { defaultPageSize = DEFAULT_PAGE_SIZE } = options;

  const [page, setPage] = useState(0); // 0-indexed
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Calculate offset and limit for API
  const offset = page * pageSize;
  const limit = pageSize;

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Get paginated data (client-side)
  const paginatedData = useMemo(() => {
    const start = offset;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, offset, pageSize]);

  // Navigation flags
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  // Controls
  const goToPage = (newPage: number) => {
    const safePage = Math.max(0, Math.min(newPage, totalPages - 1));
    setPage(safePage);
  };

  const nextPage = () => {
    if (hasNextPage) setPage(page + 1);
  };

  const prevPage = () => {
    if (hasPrevPage) setPage(page - 1);
  };

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setPage(0); // Reset to first page when page size changes
  };

  const reset = () => {
    setPage(0);
    setPageSize(defaultPageSize);
  };

  return {
    state: {
      page,
      pageSize,
      offset,
      limit,
    },
    controls: {
      goToPage,
      nextPage,
      prevPage,
      setPageSize: handleSetPageSize,
      reset,
    },
    paginatedData,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
}
