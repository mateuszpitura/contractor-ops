import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import { DataTable, WORKBENCH_DATA_TABLE_CLASS } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef } from '@tanstack/react-table';
import { Inbox, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
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
    }).format(minorToMajor(minor, safeCurrency));
  } catch {
    return `${minorToMajor(minor, safeCurrency).toFixed(minorUnitDigits(safeCurrency))} ${safeCurrency}`;
  }
}

const LOAD_MORE_PAGE_SIZE = 100;

export function IntakeList({ list }: IntakeListProps) {
  const t = useTranslations('EInvoice.intake');
  const tColumn = useTranslations('EInvoice.intake.column');
  const { formatDate } = useDateFormatter();

  const [pageIndex, setPageIndex] = useState(0);

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
        header: () => <span className="block text-end">{tColumn('total')}</span>,
        cell: ({ row }) => (
          <span className="block text-end font-mono tabular-nums">
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

  const getRowId = useCallback((row: IntakeRow) => row.id, []);

  const filtersToolbar = (
    <div className="shrink-0">
      <IntakeFilterChips />
    </div>
  );

  return (
    <div className={`${WORKBENCH_DATA_TABLE_CLASS} gap-6`} data-slot="intake-list">
      <DataTable
        columns={columns}
        data={list.rows}
        totalRows={list.rows.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={LOAD_MORE_PAGE_SIZE}
        onPageChange={setPageIndex}
        onPageSizeChange={() => undefined}
        isLoading={list.isLoading}
        isRefetching={list.isFetching && !list.isLoading}
        toolbar={filtersToolbar}
        hideDensityToggle
        getRowId={getRowId}
        hasFiltersOrSearch={!!list.statusFilter}
        entityLabel={t('pageSubtitle')}
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

      {list.nextCursor ? (
        <div className="flex w-full justify-center">
          <Button type="button" variant="ghost" onClick={list.onLoadMore}>
            {t('loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
