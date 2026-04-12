'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
          owner: filters.owner,
          team: filters.team,
          billingModel: filters.billingModel,
          health: filters.health,
        }}
        onFiltersChange={handleFiltersChange}
        isSearching={isRefetching}
        onAddContractor={onAddContractor}
        onImport={onImport}
      />

      {/* Bulk actions bar */}
      <DataTableBulkActions table={table} />

      {/* Table */}
      <div className="relative rounded-xl border bg-background">
        {/* Refetch overlay — shows when data is stale and new data is loading */}
        {isRefetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <div className="flex items-center justify-end border-b px-4 py-2">
          <DataTableColumnToggle table={table} />
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : undefined
                    }
                    style={
                      header.column.getSize() !== 150
                        ? { width: header.column.getSize() }
                        : undefined
                    }>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 uppercase hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                        aria-label={tAria('sortBy', {
                          column:
                            typeof header.column.columnDef.header === 'string'
                              ? header.column.columnDef.header
                              : header.id,
                        })}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton loading rows
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {table.getVisibleLeafColumns().map(col => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row.original)}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : hasFiltersOrSearch ? (
              // No search results
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-16 text-center">
                  <h3 className="text-[16px] font-medium">{t('noResults.heading')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('noResults.body')}</p>
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    {t('noResults.cta')}
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-16 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <h3 className="mt-3 text-[16px] font-medium">{t('empty.heading')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('empty.body')}</p>
                  <Button className="mt-4" onClick={onAddContractor}>
                    {t('empty.cta')}
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!isLoading && totalRows > 0 && (
          <DataTablePagination
            table={table}
            totalRows={totalRows}
            pageSize={filters.pageSize}
            currentPage={filters.page}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </div>
  );
}
