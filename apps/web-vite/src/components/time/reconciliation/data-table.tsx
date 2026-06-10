import { TimeTrackingIllustration } from '@contractor-ops/ui';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatMinorUnits as formatMinorUnitsLib } from '../../../lib/money.js';
import { DeviationFlag } from '../deviation-flag.js';

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

export interface ReconciliationDataTableProps {
  items: ReconciliationItem[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading: boolean;
  isFetching?: boolean;
  sectionClassName?: string;
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

export function ReconciliationDataTable({
  items,
  totalCount,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  isLoading,
  isFetching,
  sectionClassName,
}: ReconciliationDataTableProps) {
  const t = useTranslations('Time');
  const tInvoices = useTranslations('Invoices');

  const handlePageChange = useCallback((next: number) => onPageChange(next + 1), [onPageChange]);

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

  return (
    <WorkbenchDataTable
      sectionClassName={sectionClassName}
      columns={columns}
      data={items}
      totalRows={totalCount}
      pageIndex={Math.max(0, currentPage - 1)}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={onPageSizeChange}
      isLoading={isLoading}
      isRefetching={isFetching}
      fill
      entityLabel={tInvoices('entityLabel', { count: totalCount })}
      emptyIllustration={TimeTrackingIllustration}
      emptyTitle={t('reconciliation.noDataHeading')}
      emptyDescription={t('reconciliation.noDataBody')}
      noResultsTitle={t('reconciliation.empty.heading')}
      noResultsDescription={t('reconciliation.empty.body')}
      getRowId={row => row.invoice.id}
    />
  );
}
