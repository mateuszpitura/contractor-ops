'use client';

import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Banknote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { Link } from '@/i18n/navigation';
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
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const paymentsQuery = useQuery(trpc.payment.listByContractor.queryOptions({ contractorId }));

  const rawItems = paymentsQuery.data ?? [];

  // Map to row type (API returns nested paymentRun/invoice relations)
  const allItems: PaymentItemRow[] = useMemo(
    () =>
      rawItems.map(item => ({
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
    [rawItems],
  );

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const items = allItems.slice((page - 1) * pageSize, page * pageSize);

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
            return (
              <span className="text-sm">
                {new Date(row.original.createdAt).toLocaleDateString('pl-PL')}
              </span>
            );
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
    [t, formatAmount],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Loading state
  if (paymentsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (allItems.length === 0 && !paymentsQuery.isLoading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
        <Banknote className="size-8 text-muted-foreground/50" />
        <h4 className="text-sm font-medium">{t('contractorEmptyHeading')}</h4>
        <p className="max-w-sm text-sm text-muted-foreground">{t('contractorEmptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with total paid stat */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('tabPayments')}</h3>
        <div className="text-sm text-muted-foreground">
          {t('totalPaid')}:{' '}
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatAmount(totalPaidMinor, totalPaidCurrency)}
          </span>
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
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id} className="hover:bg-muted/50">
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
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            &raquo;
          </Button>
        </div>
      )}
    </div>
  );
}
