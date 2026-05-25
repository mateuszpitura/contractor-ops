/**
 * Admin reconciliation view table — data-only render path.
 *
 * Variant pick (loading / error / empty / data) lives in the container.
 * This view only renders the populated table + paginated load-more.
 */

import { AtelierTableShell, TableChrome } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
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
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
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

  const loadMoreFooter = hasNextPage ? (
    <div className="flex w-full justify-center border-t p-4">
      <Button type="button" variant="ghost" disabled={isFetchingNextPage} onClick={onLoadMore}>
        {isFetchingNextPage ? tTransmissions('loadingMore') : tSettings('loadMore')}
      </Button>
    </div>
  ) : null;

  return (
    <AtelierTableShell
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
          <TableRow>
            <TableHead>{t('columns.contractor')}</TableHead>
            <TableHead>{t('columns.period')}</TableHead>
            <TableHead className="text-end">{t('reconciliation.approvedHours')}</TableHead>
            <TableHead className="text-end">{t('reconciliation.expectedAmount')}</TableHead>
            <TableHead className="text-end">{t('reconciliation.invoicedAmount')}</TableHead>
            <TableHead>{t('reconciliation.deviation')}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.invoice.id}>
              <TableCell className="text-sm font-medium">
                {item.contractor?.legalName ?? t('reconciliation.unknown')}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatPeriod(item)}</TableCell>
              <TableCell className="text-end text-sm font-medium tabular-nums">
                {formatHours(item.reconciliation.approvedMinutes)}
              </TableCell>
              <TableCell className="text-end text-sm tabular-nums">
                {formatMinorUnits(item.reconciliation.expectedAmountMinor)}{' '}
                <span className="text-muted-foreground">{item.invoice.currency}</span>
              </TableCell>
              <TableCell className="text-end text-sm tabular-nums">
                {formatMinorUnits(item.reconciliation.invoicedAmountMinor)}{' '}
                <span className="text-muted-foreground">{item.invoice.currency}</span>
              </TableCell>
              <TableCell>
                <DeviationFlag
                  deviationPercent={item.reconciliation.deviationPercent}
                  thresholdPercent={item.reconciliation.thresholdPercent}
                  expectedAmountMinor={item.reconciliation.expectedAmountMinor}
                  invoicedAmountMinor={item.reconciliation.invoicedAmountMinor}
                  rateValueMinor={item.reconciliation.rateValueMinor}
                  approvedMinutes={item.reconciliation.approvedMinutes}
                />
              </TableCell>
              <TableCell>
                <Link
                  href={`/invoices/${item.invoice.id}`}
                  className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">{t('reconciliation.viewInvoice')}</span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AtelierTableShell>
  );
}
