'use client';

import { AtelierTableShell, InvoicesIllustration } from '@contractor-ops/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { parseFilterParam } from '@/components/invoices/einvoice-compliance-filter-chips';
import { DataTableBody } from '@/components/shared/data-table-body';
import { SortableTableHead } from '@/components/shared/sortable-table-head';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';
import type { InvoiceRow } from './columns';
import { deriveComplianceStatus, getColumns } from './columns';
import { DataTablePagination } from './data-table-pagination';
import { DataTableToolbar } from './data-table-toolbar';
import { useInvoiceFilters } from './use-invoice-filters';

// ---------------------------------------------------------------------------
// Overdue row detection
// ---------------------------------------------------------------------------

const NON_OVERDUE_STATUSES = new Set(['PAID', 'VOID']);

function isRowOverdue(row: InvoiceRow): boolean {
  if (!row.dueDate || NON_OVERDUE_STATUSES.has(row.status)) return false;
  return new Date(row.dueDate) < new Date();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InvoiceDataTableProps {
  onRowClick: (invoice: InvoiceRow) => void;
  onUpload: () => void;
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
 * TanStack Table wrapper for the invoice list.
 * Uses server-side pagination, sorting, and filtering via tRPC.
 * URL state is managed by nuqs for shareable filtered views.
 */
export function InvoiceDataTable({ onRowClick, onUpload, parentLoading }: InvoiceDataTableProps) {
  const t = useTranslations('Invoices');
  const { formatDate } = useDateFormatter();
  const tAria = useTranslations('Common.aria');

  // URL-synced filter state
  const [filters, setFilters] = useInvoiceFilters();

  // Row selection state
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Build query input from URL state
  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      sortBy:
        (filters.sortBy as
          | 'receivedAt'
          | 'invoiceNumber'
          | 'issueDate'
          | 'dueDate'
          | 'totalMinor'
          | 'status') || 'receivedAt',
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
      filters: {
        status: filters.status.length
          ? (filters.status as Array<
              | 'RECEIVED'
              | 'UNDER_REVIEW'
              | 'APPROVAL_PENDING'
              | 'APPROVED'
              | 'REJECTED'
              | 'READY_FOR_PAYMENT'
              | 'PARTIALLY_PAID'
              | 'PAID'
              | 'VOID'
            >)
          : undefined,
        matchStatus:
          filters.matchStatus.length > 0
            ? (filters.matchStatus as Array<
                'UNMATCHED' | 'PARTIAL' | 'MATCHED' | 'DISCREPANCY' | 'MANUALLY_CONFIRMED'
              >)
            : undefined,
        source: filters.source.length
          ? (filters.source as Array<'MANUAL_UPLOAD' | 'EMAIL_INTAKE' | 'KSEF' | 'API'>)
          : undefined,
        contractorId: filters.contractorId || undefined,
      },
    }),
    [filters],
  );

  // Fetch data via tRPC
  const invoicesQuery = useQuery({
    ...trpc.invoice.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  // Phase 61 · Plan 61-08 — client-side compliance filter derived from the
  // URL chip state (`?einvoiceStatus=invalid` or `invalid,failed`). Server
  // has no EInvoiceLifecycle filter on invoice.list yet, so we narrow the
  // loaded page client-side. Server-side filter would require extending
  // invoice.list's input shape — tracked as a deferred item.
  const searchParams = useSearchParams();
  const complianceFilters = useMemo(
    () => parseFilterParam(searchParams?.get('einvoiceStatus') ?? null),
    [searchParams],
  );
  const isComplianceFilterActive =
    complianceFilters.length > 0 && !complianceFilters.includes('all');

  const data = useMemo(() => {
    const result = invoicesQuery.data as { items: InvoiceRow[]; total: number } | undefined;
    const rows = result?.items ?? [];
    if (!isComplianceFilterActive) return rows;
    const allowed = new Set(complianceFilters);
    return rows.filter(row => allowed.has(deriveComplianceStatus(row.eInvoiceLifecycle)));
  }, [invoicesQuery.data, complianceFilters, isComplianceFilterActive]);

  const totalRows = useMemo(() => {
    const result = invoicesQuery.data as { items: unknown[]; total: number } | undefined;
    // When a compliance filter is active we can't report the server's
    // total (it doesn't know about EInvoiceLifecycle). Report the
    // client-filtered page size so pagination reflects what's visible.
    if (isComplianceFilterActive) return data.length;
    return result?.total ?? 0;
  }, [invoicesQuery.data, isComplianceFilterActive, data.length]);

  // Column definitions
  const columns: ColumnDef<InvoiceRow>[] = useMemo(
    () => getColumns((key: string) => t(key as Parameters<typeof t>[0]), formatDate),
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
        void setFilters({ sortBy: 'receivedAt', sortOrder: 'desc', page: 1 });
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
        matchStatus: string[];
        source: string[];
        contractorId: string;
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

  const rowClassName = useCallback(
    (row: InvoiceRow) => (isRowOverdue(row) ? 'bg-destructive/5' : ''),
    [],
  );

  // Clear filters for "no results" CTA
  const clearFilters = useCallback(() => {
    void setFilters({
      search: '',
      status: [],
      matchStatus: [],
      source: [],
      contractorId: '',
      page: 1,
    });
  }, [setFilters]);

  const isLoading = invoicesQuery.isPending && !invoicesQuery.data;
  const isRefetching = invoicesQuery.isFetching && !isLoading;
  const hasFiltersOrSearch =
    filters.search.length > 0 ||
    filters.status.length > 0 ||
    filters.matchStatus.length > 0 ||
    filters.source.length > 0 ||
    filters.contractorId.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: search, filters, upload button */}
      <DataTableToolbar
        search={filters.search}
        onSearchChange={handleSearchChange}
        filters={{
          status: filters.status,
          matchStatus: filters.matchStatus,
          source: filters.source,
        }}
        onFiltersChange={handleFiltersChange}
        isSearching={isRefetching}
        disabled={isLoading || parentLoading === true}
        onUpload={onUpload}
      />

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
            emptyIcon={<InvoicesIllustration className="mx-auto h-16 w-16 text-primary/60" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onUpload}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={clearFilters}
            skeletonColumns={{
              select: { shape: 'checkbox' },
              invoiceNumber: { shape: 'text', width: 'w-28' },
              contractor: { shape: 'text', width: 'w-36' },
              issueDate: { shape: 'text', width: 'w-24' },
              dueDate: { shape: 'text', width: 'w-24' },
              subtotalMinor: { shape: 'text', width: 'w-20' },
              totalMinor: { shape: 'text', width: 'w-24' },
              currency: { shape: 'text', width: 'w-12' },
              status: { shape: 'badge' },
              matchStatus: { shape: 'badge' },
              source: { shape: 'badge' },
              einvoiceCompliance: { shape: 'badge' },
              overdueInterest: { shape: 'text', width: 'w-20' },
              skonto: { shape: 'text', width: 'w-16' },
            }}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}
