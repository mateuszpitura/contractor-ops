'use client';

import { AtelierEmptyState, PaymentsIllustration } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { DataTableBody } from '@/components/shared/data-table-body';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Row type (mapped from listByContractor return shape)
// ---------------------------------------------------------------------------

type PaymentItemRow = {
  id: string;
  paymentRunId: string;
  runNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  markedPaidAt: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Item status badge styling
// ---------------------------------------------------------------------------

const itemStatusBadgeColors: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground border border-border',
  PAID: 'bg-green-500/10 text-green-600 dark:text-green-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  EXPORTED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TabPaymentsProps = {
  contractorId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabPayments({ contractorId }: TabPaymentsProps) {
  const t = useTranslations('Payments');
  const { formatDate } = useDateFormatter();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // F-DB-09: cursor-paginated server response — first page covers up to 200 items.
  // The contractor profile UI paginates client-side over the loaded slice; deeper
  // history is bounded to keep the request fast.
  const paymentsQuery = useQuery(
    trpc.payment.listByContractor.queryOptions({ contractorId, take: 200 }),
  );

  // Map to row type (API returns nested paymentRun/invoice relations).
  // Memoize against paymentsQuery.data (stable ref from React Query) rather
  // than the inline `data?.items ?? []` whose `[]` fallback creates a new
  // array reference on every render during loading.
  const allItems: PaymentItemRow[] = useMemo(
    () =>
      (paymentsQuery.data?.items ?? []).map(item => ({
        id: item.id,
        paymentRunId: item.paymentRunId,
        runNumber: item.paymentRun?.runNumber ?? '--',
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoice?.invoiceNumber ?? '--',
        amountMinor: item.amountMinor,
        currency: item.currency,
        status: item.status,
        paymentReference: item.paymentReference ?? null,
        markedPaidAt: item.markedPaidAt ? String(item.markedPaidAt) : null,
        createdAt: String(item.createdAt ?? item.paymentRun?.createdAt ?? ''),
      })),
    [paymentsQuery.data],
  );

  // Client-side pagination — memoize the page slice so TanStack Table's
  // `data` prop is referentially stable while loading.
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const items = useMemo(
    () => allItems.slice((page - 1) * pageSize, page * pageSize),
    [allItems, page],
  );

  // Total paid calculation (sum of PAID items in minor units)
  const totalPaidMinor = useMemo(
    () =>
      allItems
        .filter(item => item.status === 'PAID')
        .reduce((sum, item) => sum + item.amountMinor, 0),
    [allItems],
  );

  const totalPaidCurrency = allItems[0]?.currency ?? 'PLN';

  const formatAmount = useCallback(
    (minor: number, currency: string) =>
      new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(minor / 100) +
      ' ' +
      currency,
    [],
  );

  const columns: ColumnDef<PaymentItemRow>[] = useMemo(
    () => [
      {
        accessorKey: 'runNumber',
        header: t('columnRunNumber'),
        cell: ({ row }) => (
          <Link href={`/payments`} className="font-medium text-primary hover:underline">
            {row.original.runNumber}
          </Link>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('columnDate'),
        cell: ({ row }) => {
          if (!row.original.createdAt)
            return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return <span className="text-sm">{formatDate(row.original.createdAt)}</span>;
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: 'invoiceNumber',
        header: t('columnInvoiceNumber'),
        cell: ({ row }) => (
          <Link
            href={`/invoices/${row.original.invoiceId}`}
            className="font-medium text-primary hover:underline">
            {row.original.invoiceNumber}
          </Link>
        ),
      },
      {
        accessorKey: 'amountMinor',
        header: t('columnAmount'),
        cell: ({ row }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatAmount(row.original.amountMinor, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('columnStatus'),
        cell: ({ row }) => (
          <Badge variant="secondary" className={itemStatusBadgeColors[row.original.status] ?? ''}>
            {t(
              `itemStatus${row.original.status.charAt(0) + row.original.status.slice(1).toLowerCase()}` as Parameters<
                typeof t
              >[0],
            )}
          </Badge>
        ),
      },
      {
        accessorKey: 'paymentReference',
        header: t('columnReference'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.paymentReference ?? '\u2014'}
          </span>
        ),
      },
    ],
    [t, formatAmount, formatDate],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const isLoading = paymentsQuery.isLoading;

  // Empty state only when fully loaded and truly empty
  if (!isLoading && allItems.length === 0) {
    return (
      <AtelierEmptyState
        illustration={PaymentsIllustration}
        heading={t('contractorEmptyHeading')}
        body={t('contractorEmptyBody')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with total paid stat */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('tabPayments')}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('totalPaid')}:</span>
          {isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatAmount(totalPaidMinor, totalPaidCurrency)}
            </span>
          )}
        </div>
      </div>

      {/* Mini table */}
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
            emptyTitle={t('contractorEmptyHeading')}
            emptyDescription={t('contractorEmptyBody')}
            noResultsTitle={t('contractorEmptyHeading')}
            skeletonRows={5}
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
    </div>
  );
}
