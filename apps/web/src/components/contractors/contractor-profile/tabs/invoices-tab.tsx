'use client';

import { AtelierEmptyState, InvoicesIllustration, SectionLabel } from '@contractor-ops/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Receipt, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import type { InvoiceRow } from '@/components/invoices/invoice-table/columns';
import { getColumns } from '@/components/invoices/invoice-table/columns';
import { InvoiceUploadArea } from '@/components/invoices/invoice-upload-area';
import { DataTableBody } from '@/components/shared/data-table-body';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Overdue row detection
// ---------------------------------------------------------------------------

const NON_OVERDUE_STATUSES = new Set(['PAID', 'VOID']);

function isRowOverdue(row: InvoiceRow): boolean {
  if (!row.dueDate || NON_OVERDUE_STATUSES.has(row.status)) return false;
  return new Date(row.dueDate) < new Date();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InvoicesTabProps {
  contractorId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Contractor profile Invoices tab.
 * Shows invoices pre-filtered to the contractor, with upload dialog.
 * Uses same columns as /invoices page MINUS the Contractor column.
 */
export function InvoicesTab({ contractorId }: InvoicesTabProps) {
  const t = useTranslations('Invoices');
  const { formatDate } = useDateFormatter();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch invoices scoped to this contractor
  const invoicesQuery = useQuery(
    trpc.invoice.list.queryOptions({
      page,
      pageSize,
      sortBy: 'receivedAt',
      sortOrder: 'desc',
      filters: {
        contractorId,
      },
    }),
  );

  const data = useMemo(() => {
    const result = invoicesQuery.data as { items: InvoiceRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [invoicesQuery.data]);

  const totalRows = useMemo(() => {
    const result = invoicesQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [invoicesQuery.data]);

  // Column definitions - filter out contractor column since we're scoped
  const columns: ColumnDef<InvoiceRow>[] = useMemo(() => {
    const allColumns = getColumns(t, formatDate);
    return allColumns.filter(col => col.id !== 'contractor');
  }, [t, formatDate]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  // TanStack Table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId: row => row.id,
  });

  const handleUploadComplete = useCallback(() => {
    setUploadOpen(false);
    queryClient.invalidateQueries({
      queryKey: trpc.invoice.list.queryKey(),
    });
  }, [queryClient]);

  const isLoading = invoicesQuery.isLoading;

  // Empty state only when fully loaded and truly empty
  if (!isLoading && data.length === 0) {
    return (
      <>
        <AtelierEmptyState
          variant="subview"
          illustration={InvoicesIllustration}
          heading={t('tab.noInvoicesHeading')}
          body={t('tab.noInvoicesBody')}
          primaryAction={{
            label: t('tab.uploadInvoice'),
            onClick: () => setUploadOpen(true),
            icon: Upload,
          }}
          renderAction={(action, variant) => {
            const Icon = action.icon;
            return (
              <Button
                variant={variant === 'secondary' ? 'outline' : 'default'}
                onClick={action.onClick}>
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {action.label}
              </Button>
            );
          }}
        />
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('upload.heading')}</DialogTitle>
            </DialogHeader>
            <InvoiceUploadArea onUploadComplete={handleUploadComplete} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with upload CTA */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={Receipt}>{t('tab.heading')}</SectionLabel>
        </div>
        <Button
          size="sm"
          disabled={isLoading}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => setUploadOpen(true)}>
          <Upload className="me-1.5 size-3.5" />
          {t('tab.uploadInvoice')}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-background">
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
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            rowClassName={row => (isRowOverdue(row) ? 'bg-destructive/5' : '')}
          />
        </Table>
      </div>

      {/* Simple pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || page <= 1}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setPage(p => Math.max(1, p - 1))}>
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || page >= totalPages}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            &raquo;
          </Button>
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('upload.heading')}</DialogTitle>
          </DialogHeader>
          <InvoiceUploadArea onUploadComplete={handleUploadComplete} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
