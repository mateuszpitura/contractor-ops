'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { DataTableBody } from '@/components/shared/data-table-body';
import { SortableTableHead } from '@/components/shared/sortable-table-head';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/trpc/init';
import type { InvoiceRow } from './columns';
import { getColumns } from './columns';
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
}

/**
 * TanStack Table wrapper for the invoice list.
 * Uses server-side pagination, sorting, and filtering via tRPC.
 * URL state is managed by nuqs for shareable filtered views.
 */
export function InvoiceDataTable({ onRowClick, onUpload }: InvoiceDataTableProps) {
  const t = useTranslations('Invoices');
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
        matchStatus: filters.matchStatus
          ? ([filters.matchStatus] as Array<
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

  const data = useMemo(() => {
    const result = invoicesQuery.data as { items: InvoiceRow[]; totalCount: number } | undefined;
    return result?.items ?? [];
  }, [invoicesQuery.data]);

  const totalRows = useMemo(() => {
    const result = invoicesQuery.data as { items: unknown[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
  }, [invoicesQuery.data]);

  // Column definitions
  const columns: ColumnDef<InvoiceRow>[] = useMemo(
    () => getColumns((key: string) => t(key as Parameters<typeof t>[0])),
    [t],
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

  // Clear filters for "no results" CTA
  const clearFilters = useCallback(() => {
    void setFilters({
      search: '',
      status: [],
      matchStatus: '',
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
          source: filters.source,
        }}
        onFiltersChange={handleFiltersChange}
        isSearching={isRefetching}
        onUpload={onUpload}
      />

      {/* Table */}
      <div className="relative rounded-xl border bg-background">
        {/* Refetch overlay */}
        {!!isRefetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
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
            rowClassName={row => (isRowOverdue(row) ? 'bg-destructive/5' : '')}
            emptyIcon={<FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onUpload}
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
