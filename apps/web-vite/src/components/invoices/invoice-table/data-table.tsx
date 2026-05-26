import {
  AtelierTableShell,
  InvoicesIllustration,
  TableChrome,
  WORKBENCH_DATA_TABLE_CLASS,
} from '@contractor-ops/ui';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import { DataTableBody } from '../../shared/data-table-body.js';
import { SortableTableHead } from '../../shared/sortable-table-head.js';
import type { InvoiceListTableProps } from '../hooks/use-invoice-list.js';
import type { InvoiceRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTablePagination } from './data-table-pagination.js';

interface InvoiceDataTableProps extends InvoiceListTableProps {
  onRowClick: (invoice: InvoiceRow) => void;
  onUpload: () => void;
  parentLoading?: boolean;
  toolbar: ReactNode;
}

/**
 * Presentational TanStack Table for the invoice list.
 * Data fetching lives in `useInvoiceList` via container props.
 */
export function InvoiceDataTable({
  data,
  totalRows,
  filters,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  clearFilters,
  isLoading,
  isRefetching,
  activeFilterCount,
  hasFiltersOrSearch,
  onRowClick,
  onUpload,
  parentLoading,
  toolbar,
}: InvoiceDataTableProps) {
  const t = useTranslations('Invoices');
  const tAria = useTranslations('Common.aria');

  const formatDateFn = useCallback(
    (value: Date | string | null | undefined) => formatDate(value),
    [],
  );

  const columns: ColumnDef<InvoiceRow>[] = useMemo(
    () => getColumns(t, formatDateFn),
    [t, formatDateFn],
  );

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / filters.pageSize),
    state: {
      sorting: [
        {
          id: filters.sortBy,
          desc: filters.sortOrder === 'desc',
        },
      ],
    },
    onSortingChange: updater => {
      const next =
        typeof updater === 'function'
          ? updater([{ id: filters.sortBy, desc: filters.sortOrder === 'desc' }])
          : updater;
      const first = next[0];
      if (first) {
        onSortChange(first.id, first.desc ? 'desc' : 'asc');
      } else {
        onSortChange('receivedAt', 'desc');
      }
    },
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getRowId: row => row.id,
  });

  return (
    <div className={WORKBENCH_DATA_TABLE_CLASS}>
      <div className="shrink-0">{toolbar}</div>

      <AtelierTableShell
        isLoading={isLoading || isRefetching || parentLoading === true}
        chrome={
          <TableChrome
            totalCount={totalRows}
            entityLabel={t('entityLabel', { count: totalRows })}
            hasActiveFilters={hasFiltersOrSearch}
            clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
            onClearFilters={clearFilters}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }
        footer={
          !isLoading && totalRows > 0 ? (
            <DataTablePagination
              table={table}
              totalRows={totalRows}
              pageSize={filters.pageSize}
              currentPage={filters.page}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
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
            emptyIcon={<InvoicesIllustration className="mx-auto h-16 w-16 text-primary/60" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onUpload}
            emptyCtaIcon={Upload}
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
