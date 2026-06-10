import { useCallback, useMemo } from 'react';

import { useListDataTable } from '../../../hooks/use-list-data-table.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { WorkflowRunRow } from '../workflow-runs-table/columns.js';
import { useWorkflowFilters } from '../workflow-runs-table/use-workflow-filters.js';
import { useWorkflowRunsTable, useWorkflowRunsTableTemplates } from './use-workflow-ui.js';

const STORAGE_KEY = 'workflow-runs-table-columns';

export function useWorkflowRunsDataTable() {
  const t = useTranslations('Workflows');
  const tAria = useTranslations('Common.aria');

  const [filters, setFilters] = useWorkflowFilters();

  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      sortBy: (filters.sortBy as 'createdAt' | 'dueAt' | 'status' | 'startedAt') || 'dueAt',
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'asc',
      filters: {
        status: filters.status.length ? filters.status : undefined,
        templateId: filters.templateId.length ? filters.templateId : undefined,
        overdueOnly: filters.overdueOnly || undefined,
      },
    }),
    [filters],
  );

  const runsQuery = useWorkflowRunsTable(queryInput);
  const templatesQuery = useWorkflowRunsTableTemplates();
  const templates =
    (templatesQuery.data as { items: Array<{ id: string; name: string }> } | undefined)?.items ??
    [];

  const data = useMemo(() => {
    const result = runsQuery.data as { items: WorkflowRunRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [runsQuery.data]);

  const totalRows = useMemo(() => {
    const result = runsQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [runsQuery.data]);

  const handleSortChange = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      void setFilters({ sortBy, sortOrder, page: 1 });
    },
    [setFilters],
  );

  const {
    columnVisibility,
    setColumnVisibility,
    sorting,
    handleSortingChange,
  } = useListDataTable<WorkflowRunRow>({
    storageKey: STORAGE_KEY,
    filters: {
      sortBy: filters.sortBy,
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'asc',
    },
    onSortChange: handleSortChange,
    defaultSortBy: 'dueAt',
    defaultSortOrder: 'asc',
  });

  const handleFiltersChange = useCallback(
    (
      partial: Partial<{
        status: string[];
        templateId: string[];
        overdueOnly: boolean;
      }>,
    ) => {
      void setFilters({ ...partial, page: 1 });
    },
    [setFilters],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      void setFilters({ search: value, page: 1 });
    },
    [setFilters],
  );

  const handlePageChange = useCallback(
    (pageIndex: number) => {
      void setFilters({ page: pageIndex + 1 });
    },
    [setFilters],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      void setFilters({ pageSize, page: 1 });
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    void setFilters({
      search: '',
      status: [],
      templateId: [],
      overdueOnly: false,
      page: 1,
    });
  }, [setFilters]);

  const isLoading = runsQuery.isPending && !runsQuery.data;
  const isRefetching = runsQuery.isFetching && !isLoading;
  const activeFilterCount =
    (filters.search.length > 0 ? 1 : 0) +
    (filters.status.length > 0 ? 1 : 0) +
    (filters.templateId.length > 0 ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0);
  const hasFiltersOrSearch = activeFilterCount > 0;

  const rowClassName = useCallback((row: WorkflowRunRow) => {
    if (row.status === 'COMPLETED' || row.status === 'CANCELLED') return '';
    if (!row.dueAt) return '';
    return new Date(row.dueAt) < new Date() ? 'bg-destructive/5' : '';
  }, []);

  return {
    t,
    tAria,
    filters,
    data,
    totalRows,
    sorting,
    onSortingChange: handleSortingChange,
    columnVisibility,
    setColumnVisibility,
    isLoading,
    isRefetching,
    activeFilterCount,
    hasFiltersOrSearch,
    handleFiltersChange,
    handleSearchChange,
    handlePageChange,
    handlePageSizeChange,
    clearFilters,
    rowClassName,
    templates,
  } as const;
}
