import {
  AtelierEmptyState,
  AtelierTableShell,
  PaymentsIllustration,
  SectionLabel,
  TableChrome,
} from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { CreditCard } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { DataTableBody } from '../../shared/data-table-body.js';
import type {
  ContractorTabPaymentRow,
  useContractorTabPayments,
} from '../hooks/use-contractor-tab-payments.js';

const itemStatusBadgeColors: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground border border-border',
  PAID: 'bg-green-500/10 text-green-800 dark:text-green-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  EXPORTED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

export type TabPaymentsViewProps = {
  contractorId: string;
} & ReturnType<typeof useContractorTabPayments>;

export function TabPaymentsView({
  contractorId: _contractorId,
  page,
  setPage,
  items,
  allItems,
  totalPages,
  totalPaidMinor,
  totalPaidCurrency,
  formatAmount,
  isLoading,
}: TabPaymentsViewProps) {
  const t = useTranslations('Payments');
  const tInvoices = useTranslations('Invoices');
  const tAria = useTranslations('Common.aria');
  const { formatDate } = useDateFormatter();

  const columns: ColumnDef<ContractorTabPaymentRow>[] = useMemo(
    () => [
      {
        accessorKey: 'runNumber',
        header: t('columnRunNumber'),
        cell: ({ row }) => (
          <Link href="/payments" className="font-medium text-primary hover:underline">
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

  if (!isLoading && allItems.length === 0) {
    return (
      <AtelierEmptyState
        variant="subview"
        illustration={PaymentsIllustration}
        heading={t('contractorEmptyHeading')}
        body={t('contractorEmptyBody')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={CreditCard}>{t('tabPayments')}</SectionLabel>
        </div>
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

      <AtelierTableShell
        isLoading={isLoading}
        chrome={
          <TableChrome
            totalCount={allItems.length}
            entityLabel={tInvoices('entityLabel', { count: allItems.length })}
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
            emptyTitle={t('contractorEmptyHeading')}
            emptyDescription={t('contractorEmptyBody')}
            noResultsTitle={t('contractorEmptyHeading')}
            skeletonRows={5}
          />
        </Table>
      </AtelierTableShell>

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || page <= 1}
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
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            &raquo;
          </Button>
        </div>
      ) : null}
    </div>
  );
}
