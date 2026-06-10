import { InvoicesIllustration } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import type { InvoiceListTableProps } from '../hooks/use-invoice-list.js';
import type { InvoiceRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTableBulkActions } from './data-table-bulk-actions.js';

interface InvoiceDataTableProps extends InvoiceListTableProps {
  onRowClick: (invoice: InvoiceRow) => void;
  onUpload: () => void;
  parentLoading?: boolean;
  toolbar: ReactNode;
  sectionClassName?: string;
}

export function InvoiceDataTable({
  data,
  totalRows,
  filters,
  onPageChange,
  onPageSizeChange,
  clearFilters,
  isLoading,
  isRefetching,
  activeFilterCount,
  hasFiltersOrSearch,
  bulkActions,
  sorting,
  onSortingChange,
  selectedRows,
  setSelectedRows,
  onRowClick,
  onUpload,
  parentLoading,
  toolbar,
  sectionClassName,
}: InvoiceDataTableProps) {
  const t = useTranslations('Invoices');

  const formatDateFn = useCallback(
    (value: Date | string | null | undefined) => formatDate(value),
    [],
  );

  const columns: ColumnDef<InvoiceRow>[] = useMemo(
    () => getColumns(t, formatDateFn),
    [t, formatDateFn],
  );

  return (
    <WorkbenchDataTable
      sectionClassName={sectionClassName}
      columns={columns}
      data={data}
      totalRows={totalRows}
      pageIndex={Math.max(0, filters.page - 1)}
      pageSize={filters.pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      isLoading={isLoading}
      isRefetching={isRefetching}
      forceLoading={parentLoading}
      entityLabel={t('entityLabel', { count: totalRows })}
      hasFiltersOrSearch={hasFiltersOrSearch}
      onClearFilters={clearFilters}
      clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
      toolbar={toolbar}
      bulkBar={
        selectedRows.length > 0 ? (
          <DataTableBulkActions
            selectedRows={selectedRows}
            bulkActions={bulkActions}
            onComplete={() => setSelectedRows([])}
          />
        ) : undefined
      }
      enableRowSelection
      onSelectionChange={setSelectedRows}
      onRowClick={onRowClick}
      getRowId={row => row.id}
      emptyIcon={<InvoicesIllustration className="mx-auto h-16 w-16 text-primary/60" />}
      emptyTitle={t('empty.heading')}
      emptyDescription={t('empty.body')}
      emptyCta={t('empty.cta')}
      onEmptyCta={onUpload}
      emptyCtaIcon={Upload}
      noResultsTitle={t('noResults.heading')}
      noResultsDescription={t('noResults.body')}
      noResultsCta={t('noResults.cta')}
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
  );
}
