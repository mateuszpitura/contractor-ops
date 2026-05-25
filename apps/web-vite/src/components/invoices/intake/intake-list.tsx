import { AtelierTableShell, WORKBENCH_DATA_TABLE_CLASS } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Inbox, RefreshCw, Upload } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { DataTableBody } from '../../shared/data-table-body.js';
import type { IntakeRow, useIntakeList } from '../hooks/use-intake-list.js';
import { IntakeFilterChips } from './intake-filter-chips.js';
import { IntakeProfileLevelBadge } from './intake-profile-level-badge.js';
import { IntakeStatusPill } from './intake-status-pill.js';
import { IntakeValidationStatusPill } from './intake-validation-status-pill.js';

interface IntakeListProps {
  list: ReturnType<typeof useIntakeList>;
}

interface IntakeListErrorProps {
  onRetry: () => void;
}

export function IntakeListError({ onRetry }: IntakeListErrorProps) {
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');
  return (
    <div
      className={`${WORKBENCH_DATA_TABLE_CLASS} gap-6`}
      data-slot="intake-list"
      data-state="error">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {tProfile('error.retry')}
        </Button>
      </div>
    </div>
  );
}

function formatTotalMinor(amountMinor: unknown, currency: string | null): string | null {
  if (amountMinor === null || amountMinor === undefined) return null;
  const minor = typeof amountMinor === 'string' ? Number(amountMinor) : Number(amountMinor);
  if (!Number.isFinite(minor)) return null;
  const safeCurrency = currency ?? 'EUR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${safeCurrency}`;
  }
}

export function IntakeList({ list }: IntakeListProps) {
  const t = useTranslations('EInvoice.intake');
  const tColumn = useTranslations('EInvoice.intake.column');
  const { formatDate } = useDateFormatter();

  const columns: ColumnDef<IntakeRow>[] = useMemo(
    () => [
      {
        id: 'supplier',
        header: () => tColumn('supplier'),
        cell: ({ row }) => (
          <Link
            href={`/invoices/intake/${row.original.id}`}
            className="block w-full truncate font-medium hover:underline">
            {row.original.extractedSupplierName ?? '—'}
          </Link>
        ),
      },
      {
        id: 'invoiceNumber',
        header: () => tColumn('invoiceNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.extractedInvoiceNumber ?? '—'}</span>
        ),
      },
      {
        id: 'date',
        header: () => tColumn('date'),
        cell: ({ row }) =>
          row.original.extractedInvoiceDate ? formatDate(row.original.extractedInvoiceDate) : '—',
      },
      {
        id: 'total',
        header: () => <span className="block text-right">{tColumn('total')}</span>,
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatTotalMinor(row.original.extractedTotalMinor, row.original.extractedCurrency) ??
              '—'}
          </span>
        ),
      },
      {
        id: 'level',
        header: () => tColumn('level'),
        cell: ({ row }) =>
          row.original.extractedProfileLevel ? (
            <IntakeProfileLevelBadge level={row.original.extractedProfileLevel} />
          ) : (
            '—'
          ),
      },
      {
        id: 'status',
        header: () => tColumn('status'),
        cell: ({ row }) => <IntakeStatusPill status={row.original.status} />,
      },
      {
        id: 'validation',
        header: () => tColumn('validation'),
        cell: ({ row }) =>
          row.original.validationStatus ? (
            <IntakeValidationStatusPill status={row.original.validationStatus} />
          ) : (
            '—'
          ),
      },
    ],
    [tColumn, formatDate],
  );

  const table = useReactTable({
    data: list.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => row.id,
  });

  const loadMoreFooter = list.nextCursor ? (
    <div className="flex w-full justify-center border-t p-4">
      <Button type="button" variant="ghost" onClick={list.onLoadMore}>
        {t('loadMore')}
      </Button>
    </div>
  ) : null;

  return (
    <div className={`${WORKBENCH_DATA_TABLE_CLASS} gap-6`} data-slot="intake-list">
      <div className="shrink-0">
        <IntakeFilterChips />
      </div>

      <AtelierTableShell isLoading={list.isFetching && !list.isLoading} footer={loadMoreFooter}>
        <Table>
          <caption className="sr-only">{t('pageSubtitle')}</caption>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={list.isLoading}
            hasFiltersOrSearch={!!list.statusFilter}
            emptyIcon={<Inbox className="h-5 w-5" />}
            emptyTitle={t('emptyStateHeading')}
            emptyDescription={t('emptyStateBody')}
            emptyCta={t('splitButtonImport')}
            onEmptyCta={list.onEmptyCta}
            emptyCtaIcon={Upload}
            noResultsTitle={t('emptyStateHeading')}
            noResultsDescription={t('emptyStateBody')}
            skeletonRows={8}
            skeletonColumns={{
              supplier: { shape: 'text', width: 'w-40' },
              invoiceNumber: { shape: 'text', width: 'w-28' },
              date: { shape: 'text', width: 'w-24' },
              total: { shape: 'text', width: 'w-20' },
              level: { shape: 'badge' },
              status: { shape: 'badge' },
              validation: { shape: 'badge' },
            }}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}
