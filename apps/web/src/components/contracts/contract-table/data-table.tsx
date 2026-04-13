'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTableBody } from '@/components/shared/data-table-body';
import { SortableTableHead } from '@/components/shared/sortable-table-head';
import {
  Table,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/trpc/init';
import type { ContractRow } from './columns';
import { getColumns } from './columns';
import { DataTableBulkActions } from './data-table-bulk-actions';
import { DataTableColumnToggle } from './data-table-column-toggle';
import { DataTablePagination } from './data-table-pagination';
import { DataTableToolbar } from './data-table-toolbar';
import { useContractFilters } from './use-contract-filters';

const STORAGE_KEY = 'contract-table-columns';

/** Convert a filter array to a typed array or undefined (reduces ternary nesting). */
function asFilterArray<T extends string>(arr: string[]): T[] | undefined {
  return arr.length ? (arr as T[]) : undefined;
}

/** Convert a non-empty string to itself or undefined. */
function asFilterString(val: string): string | undefined {
  return val || undefined;
}

/** Convert a date string filter to ISO string or undefined. */
function asDateFilter(val: string): string | undefined {
  return val ? new Date(val).toISOString() : undefined;
}

interface ContractDataTableProps {
  onRowClick: (contract: ContractRow) => void;
  onNewContract: () => void;
  onImport?: () => void;
}

/**
 * TanStack Table wrapper for the contract list.
 * Uses server-side pagination, sorting, and filtering via tRPC.
 * URL state is managed by nuqs for shareable filtered views.
 */
export function ContractDataTable({ onRowClick, onNewContract, onImport }: ContractDataTableProps) {
  const t = useTranslations('Contracts');
  const tAria = useTranslations('Common.aria');

  // URL-synced filter state
  const [filters, setFilters] = useContractFilters();

  // Column visibility from localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as VisibilityState) : {};
    } catch {
      return {};
    }
  });

  // Persist column visibility
  useEffect(() => {
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
      search: asFilterString(filters.search),
      sortBy:
        (filters.sortBy as 'createdAt' | 'title' | 'status' | 'endDate' | 'startDate' | 'type') ||
        'endDate',
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'asc',
      filters: {
        status: asFilterArray<'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'SUPERSEDED' | 'ARCHIVED'>(filters.status),
        type: asFilterArray<'B2B_MASTER_SERVICE' | 'STATEMENT_OF_WORK' | 'NDA' | 'IP_ASSIGNMENT' | 'DPA' | 'OTHER'>(filters.type),
        billingModel: asFilterArray<'MONTHLY_RETAINER' | 'HOURLY' | 'DAILY' | 'MILESTONE' | 'DELIVERABLE_BASED' | 'MIXED'>(filters.billingModel),
        ownerUserId: asFilterArray(filters.ownerUserId),
        endDateFrom: asDateFilter(filters.endDateFrom),
        endDateTo: asDateFilter(filters.endDateTo),
        complianceRiskLevel: asFilterArray<'LOW' | 'MEDIUM' | 'HIGH'>(filters.complianceRiskLevel),
      },
    }),
    [filters],
  );

  // Fetch data via tRPC
  const contractsQuery = useQuery({
    ...trpc.contract.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = contractsQuery.data as { items: ContractRow[]; totalCount: number } | undefined;
    return result?.items ?? [];
  }, [contractsQuery.data]);

  const totalRows = useMemo(() => {
    const result = contractsQuery.data as { items: unknown[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
  }, [contractsQuery.data]);

  // Column definitions
  const columns: ColumnDef<ContractRow>[] = useMemo(
    () =>
      getColumns((key: string, params?: Record<string, string | number>) =>
        t(key as Parameters<typeof t>[0], params),
      ),
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
        void setFilters({ sortBy: 'endDate', sortOrder: 'asc', page: 1 });
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
        type: string[];
        billingModel: string[];
        ownerUserId: string[];
        endDateFrom: string;
        endDateTo: string;
        complianceRiskLevel: string[];
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
      type: [],
      billingModel: [],
      ownerUserId: [],
      endDateFrom: '',
      endDateTo: '',
      complianceRiskLevel: [],
      page: 1,
    });
  }, [setFilters]);

  const isLoading = contractsQuery.isPending && !contractsQuery.data;
  const isRefetching = contractsQuery.isFetching && !isLoading;
  const hasFiltersOrSearch =
    filters.search.length > 0 ||
    filters.status.length > 0 ||
    filters.type.length > 0 ||
    filters.billingModel.length > 0 ||
    filters.ownerUserId.length > 0 ||
    filters.complianceRiskLevel.length > 0 ||
    filters.endDateFrom.length > 0 ||
    filters.endDateTo.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: search, filters, new contract button */}
      <DataTableToolbar
        search={filters.search}
        onSearchChange={handleSearchChange}
        filters={{
          status: filters.status,
          type: filters.type,
          billingModel: filters.billingModel,
          ownerUserId: filters.ownerUserId,
          endDateFrom: filters.endDateFrom,
          endDateTo: filters.endDateTo,
          complianceRiskLevel: filters.complianceRiskLevel,
        }}
        onFiltersChange={handleFiltersChange}
        isSearching={isRefetching}
        onNewContract={onNewContract}
        onImport={onImport}
      />

      {/* Bulk actions bar */}
      <DataTableBulkActions table={table} />

      {/* Table */}
      <div className="relative rounded-xl border bg-background">
        {/* Refetch overlay */}
        {!!isRefetching && (
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
            hasFiltersOrSearch={hasFiltersOrSearch}
            onRowClick={onRowClick}
            emptyIcon={<FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onNewContract}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={clearFilters}
          />
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
