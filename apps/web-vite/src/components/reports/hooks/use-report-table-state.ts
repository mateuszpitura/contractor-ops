import { useListDataTable } from '../../../hooks/use-list-data-table.js';

const STORAGE_KEY = 'report-table-columns';

export interface UseReportTableStateOptions {
  sortBy: string;
  sortOrder: string;
  onSortChange: (sortBy: string, sortOrder: string) => void;
}

/**
 * Shared report-table sorting and column-visibility state (persisted via localStorage).
 */
export function useReportTableState<T>({
  sortBy,
  sortOrder,
  onSortChange,
}: UseReportTableStateOptions) {
  const resolvedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const { columnVisibility, setColumnVisibility, sorting, handleSortingChange } =
    useListDataTable<T>({
      storageKey: STORAGE_KEY,
      filters: { sortBy, sortOrder: resolvedSortOrder },
      onSortChange: (nextSortBy, nextSortOrder) => onSortChange(nextSortBy, nextSortOrder),
      defaultSortBy: sortBy,
      defaultSortOrder: resolvedSortOrder,
    });

  return {
    sorting,
    handleSortingChange,
    columnVisibility,
    setColumnVisibility,
  };
}
