import { AtelierTableShell, TableChrome } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { formatMinorUnits as formatMinorUnitsLib } from '../../lib/format-currency.js';
import { DataTableBody } from '../shared/data-table-body.js';
import { SortableTableHead } from '../shared/sortable-table-head.js';
import { DeviationFlag } from './deviation-flag.js';

interface ReconciliationItem {
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string | Date;
    totalMinor: number;
    currency: string;
    servicePeriodStart: string | Date | null;
    servicePeriodEnd: string | Date | null;
  };
  contractor: {
    id: string;
    legalName: string;
  } | null;
  reconciliation: {
    approvedMinutes: number;
    rateValueMinor: number;
    rateType: string;
    hoursPerDay: number;
    expectedAmountMinor: number;
    invoicedAmountMinor: number;
    deviationMinor: number;
    deviationPercent: number;
    withinThreshold: boolean;
    thresholdPercent: number;
  };
}

export interface ReconciliationTableViewProps {
  items: ReconciliationItem[];
  totalCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function formatMinorUnits(minor: number): string {
  return formatMinorUnitsLib(minor, null, 'pl-PL');
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatPeriod(item: ReconciliationItem): string {
  const start = item.invoice.servicePeriodStart;
  const end = item.invoice.servicePeriodEnd;
  if (start && end) {
    const s = typeof start === 'string' ? new Date(start) : start;
    const e = typeof end === 'string' ? new Date(end) : end;
    return `${format(s, 'MMM d')} - ${format(e, 'MMM d, yyyy')}`;
  }
  const issueDate =
    typeof item.invoice.issueDate === 'string'
      ? new Date(item.invoice.issueDate)
      : item.invoice.issueDate;
  return format(issueDate, 'MMM yyyy');
}

export function ReconciliationTableView({
  items,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ReconciliationTableViewProps) {
  const t = useTranslations('Time');
  const tInvoices = useTranslations('Invoices');
  const tAria = useTranslations('Common.aria');
  const tSettings = useTranslations('Settings.provider');
  const tTransmissions = useTranslations('EInvoice.TransmissionsLog');

  const columns = useMemo<ColumnDef<ReconciliationItem, unknown>[]>(
    () => [
      {
        id: 'contractor',
        accessorFn: row => row.contractor?.legalName ?? '',
        header: t('columns.contractor'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {row.original.contractor?.legalName ?? t('reconciliation.unknown')}
          </span>
        ),
      },
      {
        id: 'period',
        header: t('columns.period'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatPeriod(row.original)}</span>
        ),
      },
      {
        id: 'approvedHours',
        accessorFn: row => row.reconciliation.approvedMinutes,
        header: () => <span className="block text-end">{t('reconciliation.approvedHours')}</span>,
        cell: ({ row }) => (
          <span className="block text-end text-sm font-medium tabular-nums">
            {formatHours(row.original.reconciliation.approvedMinutes)}
          </span>
        ),
      },
      {
        id: 'expectedAmount',
        accessorFn: row => row.reconciliation.expectedAmountMinor,
        header: () => <span className="block text-end">{t('reconciliation.expectedAmount')}</span>,
        cell: ({ row }) => (
          <span className="block text-end text-sm tabular-nums">
            {formatMinorUnits(row.original.reconciliation.expectedAmountMinor)}{' '}
            <span className="text-muted-foreground">{row.original.invoice.currency}</span>
          </span>
        ),
      },
      {
        id: 'invoicedAmount',
        accessorFn: row => row.reconciliation.invoicedAmountMinor,
        header: () => <span className="block text-end">{t('reconciliation.invoicedAmount')}</span>,
        cell: ({ row }) => (
          <span className="block text-end text-sm tabular-nums">
            {formatMinorUnits(row.original.reconciliation.invoicedAmountMinor)}{' '}
            <span className="text-muted-foreground">{row.original.invoice.currency}</span>
          </span>
        ),
      },
      {
        id: 'deviation',
        accessorFn: row => row.reconciliation.deviationPercent,
        header: t('reconciliation.deviation'),
        cell: ({ row }) => (
          <DeviationFlag
            deviationPercent={row.original.reconciliation.deviationPercent}
            thresholdPercent={row.original.reconciliation.thresholdPercent}
            expectedAmountMinor={row.original.reconciliation.expectedAmountMinor}
            invoicedAmountMinor={row.original.reconciliation.invoicedAmountMinor}
            rateValueMinor={row.original.reconciliation.rateValueMinor}
            approvedMinutes={row.original.reconciliation.approvedMinutes}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/invoices/${row.original.invoice.id}`}
            className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">{t('reconciliation.viewInvoice')}</span>
          </Link>
        ),
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const loadMoreFooter = hasNextPage ? (
    <div className="flex w-full justify-center border-t p-4">
      <Button type="button" variant="ghost" disabled={isFetchingNextPage} onClick={onLoadMore}>
        {isFetchingNextPage ? tTransmissions('loadingMore') : tSettings('loadMore')}
      </Button>
    </div>
  ) : null;

  return (
    <AtelierTableShell
      constrainHeight={false}
      footer={loadMoreFooter}
      chrome={
        <TableChrome
          totalCount={totalCount}
          entityLabel={tInvoices('entityLabel', { count: totalCount })}
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
                <SortableTableHead key={header.id} header={header} />
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <DataTableBody
          table={table}
          isLoading={false}
          hasFiltersOrSearch={false}
          emptyTitle={t('reconciliation.empty.heading')}
          emptyDescription={t('reconciliation.empty.body')}
          noResultsTitle={t('reconciliation.empty.heading')}
          noResultsDescription={t('reconciliation.empty.body')}
        />
      </Table>
    </AtelierTableShell>
  );
}
