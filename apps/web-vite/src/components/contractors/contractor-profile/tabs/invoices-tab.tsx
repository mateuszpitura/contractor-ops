import {
  AtelierEmptyState,
  AtelierTableShell,
  InvoicesIllustration,
  SectionLabel,
  TableChrome,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Receipt, Upload } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../../lib/format/use-date-formatter.js';
import type { InvoiceRow } from '../../../invoices/invoice-table/columns.js';
import { getColumns } from '../../../invoices/invoice-table/columns.js';
import { InvoiceUploadAreaContainer } from '../../../invoices/invoice-upload-area-container.js';
import { renderEmptyStateAction } from '../../../shared/atelier-bridges.js';
import { DataTableBody } from '../../../shared/data-table-body.js';
import type { useContractorTabInvoices } from '../../hooks/use-contractor-tab-invoices.js';

type InvoicesTabViewProps = {
  contractorId: string;
} & ReturnType<typeof useContractorTabInvoices>;

export type InvoicesTabEmptyProps = Pick<
  InvoicesTabViewProps,
  'uploadOpen' | 'setUploadOpen' | 'handleUploadComplete'
>;

export function InvoicesTabEmpty({
  uploadOpen,
  setUploadOpen,
  handleUploadComplete,
}: InvoicesTabEmptyProps) {
  const t = useTranslations('Invoices');
  const handleOpenUpload = useCallback(() => setUploadOpen(true), [setUploadOpen]);
  const primaryAction = useMemo(
    () => ({
      label: t('tab.uploadInvoice'),
      onClick: handleOpenUpload,
      icon: Upload,
    }),
    [t, handleOpenUpload],
  );
  return (
    <>
      <AtelierEmptyState
        variant="subview"
        illustration={InvoicesIllustration}
        heading={t('tab.noInvoicesHeading')}
        body={t('tab.noInvoicesBody')}
        primaryAction={primaryAction}
        renderAction={renderEmptyStateAction}
      />
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('upload.heading')}</DialogTitle>
          </DialogHeader>
          <InvoiceUploadAreaContainer onUploadComplete={handleUploadComplete} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoicesTabView({
  contractorId,
  uploadOpen,
  setUploadOpen,
  page,
  setPage,
  data,
  totalRows,
  totalPages,
  isLoading,
  handleUploadComplete,
}: InvoicesTabViewProps) {
  const t = useTranslations('Invoices');
  const tAria = useTranslations('Common.aria');
  const { formatDate } = useDateFormatter();

  const columns: ColumnDef<InvoiceRow>[] = useMemo(() => {
    const allColumns = getColumns(t, formatDate);
    return allColumns.filter(col => col.id !== 'contractor');
  }, [t, formatDate]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId: row => row.id,
  });

  const handleOpenUpload = useCallback(() => setUploadOpen(true), [setUploadOpen]);
  const handlePrevPage = useCallback(() => setPage(p => Math.max(1, p - 1)), [setPage]);
  const handleNextPage = useCallback(
    () => setPage(p => Math.min(totalPages, p + 1)),
    [setPage, totalPages],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={Receipt}>{t('tab.heading')}</SectionLabel>
        </div>
        <Button size="sm" disabled={isLoading} onClick={handleOpenUpload}>
          <Upload className="me-1.5 size-3.5" />
          {t('tab.uploadInvoice')}
        </Button>
      </div>

      <AtelierTableShell
        isLoading={isLoading}
        chrome={
          <TableChrome
            totalCount={totalRows}
            entityLabel={t('entityLabel', { count: totalRows })}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading}
            hasFiltersOrSearch={false}
            emptyTitle={t('tab.noInvoicesHeading')}
            emptyDescription={t('tab.noInvoicesBody')}
            noResultsTitle={t('tab.noInvoicesHeading')}
            skeletonRows={6}
          />
        </Table>
      </AtelierTableShell>

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || page <= 1}
            onClick={handlePrevPage}>
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || page >= totalPages}
            onClick={handleNextPage}>
            &raquo;
          </Button>
        </div>
      ) : null}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('upload.heading')}</DialogTitle>
          </DialogHeader>
          <InvoiceUploadAreaContainer onUploadComplete={handleUploadComplete} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
