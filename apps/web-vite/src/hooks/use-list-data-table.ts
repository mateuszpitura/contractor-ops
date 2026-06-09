import type { SortingState, VisibilityState } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ListTableSortFilters {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface UseListDataTableOptions {
  storageKey: string;
  filters: ListTableSortFilters;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  defaultSortBy: string;
  defaultSortOrder?: 'asc' | 'desc';
}

/**
 * Shared list-table state: persisted column visibility, row selection, sorting sync.
 */
export function useListDataTable<T>(options: UseListDataTableOptions) {
  const { storageKey, filters, onSortChange, defaultSortBy, defaultSortOrder = 'desc' } = options;

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedRows, setSelectedRows] = useState<T[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setColumnVisibility(JSON.parse(stored) as VisibilityState);
    } catch {
      // best-effort hydration
    }
  }, [storageKey]);

  const isHydrated = useRef(false);
  useEffect(() => {
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch {
      // best-effort persistence
    }
  }, [columnVisibility, storageKey]);

  const sorting = useMemo<SortingState>(
    () => [{ id: filters.sortBy, desc: filters.sortOrder === 'desc' }],
    [filters.sortBy, filters.sortOrder],
  );

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (first) {
        onSortChange(first.id, first.desc ? 'desc' : 'asc');
      } else {
        onSortChange(defaultSortBy, defaultSortOrder);
      }
    },
    [sorting, onSortChange, defaultSortBy, defaultSortOrder],
  );

  return {
    columnVisibility,
    setColumnVisibility,
    selectedRows,
    setSelectedRows,
    sorting,
    handleSortingChange,
  };
}
