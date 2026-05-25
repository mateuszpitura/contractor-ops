import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import type { WorkflowRunRow } from '../workflow-runs-table/columns.js';
import { getColumns } from '../workflow-runs-table/columns.js';
import { useWorkflowFilters } from '../workflow-runs-table/use-workflow-filters.js';
import { useWorkflowRunsTable, useWorkflowRunsTableTemplates } from './use-workflow-ui.js';

export function useWorkflowRunsDataTable() {
  const t = useTranslations('Workflows');
  const tAria = useTranslations('Common.aria');

  const [filters, setFilters] = useWorkflowFilters();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

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

  const columns: ColumnDef<WorkflowRunRow>[] = useMemo(() => getColumns(t, formatDate), [t]);

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / filters.pageSize),
    state: {
      rowSelection,
      sorting: [
        {
          id: filters.sortBy,
          desc: filters.sortOrder === 'desc',
        },
      ],
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: updater => {
      const next =
        typeof updater === 'function'
          ? updater([{ id: filters.sortBy, desc: filters.sortOrder === 'desc' }])
          : updater;
      const first = next[0];
      if (first) {
        void setFilters({
          sortBy: first.id,
          sortOrder: first.desc ? 'desc' : 'asc',
          page: 1,
        });
      } else {
        void setFilters({ sortBy: 'dueAt', sortOrder: 'asc', page: 1 });
      }
    },
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getRowId: row => row.id,
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
    (page: number) => {
      void setFilters({ page });
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
    table,
    data,
    totalRows,
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
