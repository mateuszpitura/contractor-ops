'use client';

import { AtelierTableShell, WorkflowsIllustration } from '@contractor-ops/ui';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { DataTableBody } from '@/components/shared/data-table-body';
import { SortableTableHead } from '@/components/shared/sortable-table-head';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';
import type { WorkflowRunRow } from './columns';
import { getColumns } from './columns';
import { DataTableFilters } from './data-table-filters';
import { DataTablePagination } from './data-table-pagination';
import { DataTableToolbar } from './data-table-toolbar';
import { useWorkflowFilters } from './use-workflow-filters';

interface WorkflowRunsDataTableProps {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  /**
   * When true, DataTableBody keeps showing skeleton rows even if the
   * table's own data has already arrived, and AtelierTableShell shows its
   * loading overlay. Used by the page while its count query is still in
   * flight, so the in-table empty state never flashes before the swap to
   * AtelierEmptyState.
   */
  parentLoading?: boolean;
}

/**
 * TanStack Table wrapper for the workflow runs list.
 * Uses server-side pagination, sorting, and filtering via tRPC.
 * URL state is managed by nuqs for shareable filtered views.
 */
export function WorkflowRunsDataTable({
  onRowClick,
  onStartWorkflow,
  parentLoading,
}: WorkflowRunsDataTableProps) {
  const t = useTranslations('Workflows');
  const { formatDate } = useDateFormatter();
  const tAria = useTranslations('Common.aria');

  // URL-synced filter state
  const [filters, setFilters] = useWorkflowFilters();

  // Row selection state
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Build query input from URL state
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

  // Fetch data via tRPC
  const runsQuery = useQuery({
    ...trpc.workflow.listRuns.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = runsQuery.data as { items: WorkflowRunRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [runsQuery.data]);

  const totalRows = useMemo(() => {
    const result = runsQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [runsQuery.data]);

  // Column definitions
  const columns: ColumnDef<WorkflowRunRow>[] = useMemo(
    () => getColumns(t, formatDate),
    [t, formatDate],
  );

  // TanStack Table instance
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
        // Sort removed — reset to default
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

  // Filter change handler
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

  // Clear filters for "no results" CTA
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
  const hasFiltersOrSearch =
    filters.search.length > 0 ||
    filters.status.length > 0 ||
    filters.templateId.length > 0 ||
    filters.overdueOnly;

  /**
   * Determine if a row is overdue for background highlighting.
   */
  const rowClassName = useCallback((row: WorkflowRunRow) => {
    if (row.status === 'COMPLETED' || row.status === 'CANCELLED') return '';
    if (!row.dueAt) return '';
    return new Date(row.dueAt) < new Date() ? 'bg-destructive/5' : '';
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters + start workflow button */}
      <DataTableFilters
        filters={{
          status: filters.status,
          templateId: filters.templateId,
          overdueOnly: filters.overdueOnly,
        }}
        onFiltersChange={handleFiltersChange}
        disabled={isLoading || parentLoading === true}>
        {(filterTrigger, filterBadges) => (
          <DataTableToolbar
            search={filters.search}
            onSearchChange={handleSearchChange}
            isSearching={isRefetching}
            disabled={isLoading || parentLoading === true}
            onStartWorkflow={onStartWorkflow}
            filterTrigger={filterTrigger}
            filterBadges={filterBadges}
          />
        )}
      </DataTableFilters>

      {/* Workbench-tier table chrome. isLoading drives the translucent
          background overlay during data fetches. */}
      <AtelierTableShell
        isLoading={isLoading || isRefetching || parentLoading === true}
        footer={
          !isLoading && totalRows > 0 ? (
            <DataTablePagination
              table={table}
              totalRows={totalRows}
              pageSize={filters.pageSize}
              currentPage={filters.page}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          ) : undefined
        }>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <SortableTableHead
                    key={header.id}
                    header={header}
                    sortAriaLabel={tAria('sortBy', {
                      column:
                        typeof header.column.columnDef.header === 'string'
                          ? header.column.columnDef.header
                          : header.id,
                    })}
                  />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading}
            forceLoading={parentLoading}
            hasFiltersOrSearch={hasFiltersOrSearch}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
            emptyIcon={<WorkflowsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onStartWorkflow}
            emptyCtaIcon={Play}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={clearFilters}
            skeletonColumns={{
              select: { shape: 'checkbox' },
              workflowName: { shape: 'text', width: 'w-40' },
              contractor: { shape: 'text', width: 'w-36' },
              templateType: { shape: 'badge' },
              status: { shape: 'badge' },
              progress: { shape: 'text', width: 'w-20' },
              startedAt: { shape: 'text', width: 'w-24' },
              dueAt: { shape: 'text', width: 'w-24' },
            }}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}
