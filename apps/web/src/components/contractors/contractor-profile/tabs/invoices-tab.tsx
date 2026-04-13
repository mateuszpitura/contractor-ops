'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FileText, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import type { InvoiceRow } from '@/components/invoices/invoice-table/columns';
import { getColumns } from '@/components/invoices/invoice-table/columns';
import { InvoiceUploadArea } from '@/components/invoices/invoice-upload-area';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    const result = invoicesQuery.data as { items: InvoiceRow[]; totalCount: number } | undefined;
    return result?.items ?? [];
  }, [invoicesQuery.data]);

  const totalRows = useMemo(() => {
    const result = invoicesQuery.data as { items: unknown[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
  }, [invoicesQuery.data]);

  // Column definitions - filter out contractor column since we're scoped
  const columns: ColumnDef<InvoiceRow>[] = useMemo(() => {
    const allColumns = getColumns((key: string) => t(key as Parameters<typeof t>[0]));
    return allColumns.filter(col => col.id !== 'contractor');
  }, [t]);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
          <FileText className="size-10 text-muted-foreground/50" />
          <h4 className="text-sm font-medium">{t('tab.noInvoicesHeading')}</h4>
          <p className="max-w-sm text-sm text-muted-foreground">{t('tab.noInvoicesBody')}</p>
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="me-1.5 size-3.5" />
            {t('tab.uploadInvoice')}
          </Button>
        </div>
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
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('tab.heading')}</h3>
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        <Button size="sm" onClick={() => setUploadOpen(true)}>
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
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                className={`${isRowOverdue(row.original) ? 'bg-destructive/5' : ''}`}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Simple pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
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
            disabled={page >= totalPages}
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
