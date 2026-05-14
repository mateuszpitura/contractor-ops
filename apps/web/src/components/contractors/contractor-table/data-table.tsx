'use client';

import { AtelierTableShell, ContractorsIllustration } from '@contractor-ops/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataTableBody } from '@/components/shared/data-table-body';
import { SortableTableHead } from '@/components/shared/sortable-table-head';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/trpc/init';
import type { ContractorRow } from './columns';
import { getColumns } from './columns';
import { DataTableBulkActions } from './data-table-bulk-actions';
import { DataTableColumnToggle } from './data-table-column-toggle';
import { DataTablePagination } from './data-table-pagination';
import { DataTableToolbar } from './data-table-toolbar';
import { useContractorFilters } from './use-contractor-filters';

const STORAGE_KEY = 'contractor-table-columns';

interface ContractorDataTableProps {
  onRowClick: (contractor: ContractorRow) => void;
  onAddContractor: () => void;
  onImport?: () => void;
  /**
   * When true, DataTableBody renders skeleton rows even if the table's own
   * data has already arrived. Used by the page when its parallel count
   * query is still in flight, so the in-table empty state never flashes
   * before the page swaps to AtelierEmptyState.
   */
  parentLoading?: boolean;
}

/**
 * TanStack Table wrapper for the contractor list.
 * Uses server-side pagination, sorting, and filtering via tRPC.
 * URL state is managed by nuqs for shareable filtered views.
 */
export function ContractorDataTable({
  onRowClick,
  onAddContractor,
  onImport,
  parentLoading,
}: ContractorDataTableProps) {
  const t = useTranslations('Contractors');
  const tAria = useTranslations('Common.aria');

  // URL-synced filter state
  const [filters, setFilters] = useContractorFilters();

  // Column visibility — start empty so SSR and client match, then hydrate from localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setColumnVisibility(JSON.parse(stored) as VisibilityState);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist column visibility changes (skip the initial hydration)
  const isHydrated = useRef(false);
  useEffect(() => {
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch {
      // Ignore localStorage errors
    }
  }, [columnVisibility]);

  // Row selection state
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Build query input from URL state
  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      sortBy:
        (filters.sortBy as 'createdAt' | 'legalName' | 'status' | 'lifecycleStage' | 'type') ||
        'createdAt',
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
      filters: {
        lifecycleStage: filters.lifecycleStage.length
          ? (filters.lifecycleStage as Array<
              'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'ENDED'
            >)
          : undefined,
        type: filters.type.length
          ? (filters.type as Array<'SOLE_TRADER' | 'COMPANY' | 'INDIVIDUAL_FREELANCER' | 'OTHER'>)
          : undefined,
        ownerUserId: filters.owner.length ? filters.owner : undefined,
        primaryTeamId: filters.team.length ? filters.team : undefined,
        billingModel: filters.billingModel.length ? filters.billingModel : undefined,
        complianceHealth: filters.health.length
          ? (filters.health as Array<'green' | 'yellow' | 'red'>)
          : undefined,
      },
    }),
    [filters],
  );

  // Fetch data
  const contractorsQuery = useQuery({
    ...trpc.contractor.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = contractorsQuery.data as { items: ContractorRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [contractorsQuery.data]);

  const totalRows = useMemo(() => {
    const result = contractorsQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [contractorsQuery.data]);

  // Column definitions
  const columns: ColumnDef<ContractorRow>[] = useMemo(
    () => getColumns((key: string) => t(key as Parameters<typeof t>[0])),
    [t],
  );

  // TanStack Table instance
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / filters.pageSize),
    state: {
      columnVisibility,
      rowSelection,
      sorting: [
        {
          id: filters.sortBy,
          desc: filters.sortOrder === 'desc',
        },
      ],
    },
    onColumnVisibilityChange: setColumnVisibility,
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
        void setFilters({ sortBy: 'createdAt', sortOrder: 'desc', page: 1 });
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
        lifecycleStage: string[];
        type: string[];
        owner: string[];
        team: string[];
        billingModel: string[];
        health: string[];
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
      lifecycleStage: [],
      type: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
      page: 1,
    });
  }, [setFilters]);

  // isLoading = true only on first mount with no data (shows skeletons)
  // isRefetching = true when data exists but is being refreshed (shows overlay)
  const isLoading = contractorsQuery.isPending && !contractorsQuery.data;
  const isRefetching = contractorsQuery.isFetching && !isLoading;
  const hasFiltersOrSearch =
    filters.search.length > 0 ||
    filters.lifecycleStage.length > 0 ||
    filters.type.length > 0 ||
    filters.owner.length > 0 ||
    filters.billingModel.length > 0 ||
    filters.health.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: search, filters, add button */}
      <DataTableToolbar
        search={filters.search}
        onSearchChange={handleSearchChange}
        filters={{
          status: filters.status,
          lifecycleStage: filters.lifecycleStage,
          type: filters.type,
          owner: filters.owner,
          team: filters.team,
          billingModel: filters.billingModel,
          health: filters.health,
        }}
        onFiltersChange={handleFiltersChange}
        isSearching={isRefetching}
        disabled={isLoading || parentLoading === true}
        onAddContractor={onAddContractor}
        onImport={onImport}
      />

      {/* Bulk actions bar */}
      <DataTableBulkActions table={table} />

      {/* Workbench-tier table chrome. isLoading drives the translucent
          background overlay that visually darkens the table area while
          data is in flight — matches /approvals behaviour. */}
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
        <div className="flex items-center justify-end border-b border-border/50 px-4 py-2">
          <DataTableColumnToggle table={table} />
        </div>

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
            emptyIcon={<ContractorsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onAddContractor}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={clearFilters}
            skeletonColumns={{
              select: { shape: 'checkbox' },
              displayName: { shape: 'text', width: 'w-40' },
              type: { shape: 'badge' },
              lifecycleStage: { shape: 'badge' },
              owner: { shape: 'avatar' },
              billingModel: { shape: 'text', width: 'w-20' },
              rate: { shape: 'text', width: 'w-16' },
              currency: { shape: 'text', width: 'w-12' },
              nextInvoice: { shape: 'text', width: 'w-24' },
              teamProject: { shape: 'text', width: 'w-32' },
              contractEnd: { shape: 'text', width: 'w-24' },
              lastActivity: { shape: 'text', width: 'w-24' },
              complianceHealth: { shape: 'badge' },
            }}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}
