import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { ColumnDef } from '@tanstack/react-table';
import { FileWarning } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useDateFormatter } from '../../hooks/use-date-formatter.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';
import type { DocExpiryItem, HrDocExpiry } from './hooks/use-hr-doc-expiry.js';
import { useHrDocExpiry } from './hooks/use-hr-doc-expiry.js';
import { HrSectionCard, HrSectionEmpty, HrSectionError, HrSectionSkeleton } from './hr-section.js';

const DOC_CATEGORY_KEYS = new Set([
  'VISA',
  'WORK_PERMIT',
  'CONTRACT_RENEWAL',
  'MEDICAL_CERT',
  'TRAINING_CERT',
  'OTHER',
]);

// The urgent bands surfaced as summary chips, in ascending time-to-expiry.
const SUMMARY_BANDS = ['expired', 'soon30', 'soon60', 'soon90'] as const;
type SummaryBand = (typeof SUMMARY_BANDS)[number];

const BAND_TONE: Record<SummaryBand, string> = {
  expired: 'text-destructive',
  soon30: 'text-warning',
  soon60: 'text-warning',
  soon90: 'text-muted-foreground',
};

const BAND_BADGE: Record<SummaryBand, string> = {
  expired: 'border-destructive/40 bg-destructive/10 text-destructive',
  soon30: 'border-warning/40 bg-warning/10 text-warning',
  soon60: 'border-warning/40 bg-warning/10 text-warning',
  soon90: '',
};

export interface HrDocExpiryViewProps {
  items: readonly DocExpiryItem[];
  byBand: HrDocExpiry['byBand'];
  formatDate: (value: Date | string | null | undefined) => string;
}

/** Presentational document-expiry (HR-DASH-03). Props-in → JSX-out. */
export function HrDocExpiryView({ items, byBand, formatDate }: HrDocExpiryViewProps) {
  const t = useTranslations('HrDashboard');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const rows = useMemo(() => [...items], [items]);

  const categoryLabel = useCallback(
    (category: string | null) => {
      const key = category ?? 'OTHER';
      return DOC_CATEGORY_KEYS.has(key)
        ? t(`docExpiry.categories.${key}`)
        : t('docExpiry.categories.OTHER');
    },
    [t],
  );

  const columns = useMemo<ColumnDef<DocExpiryItem, unknown>[]>(
    () => [
      {
        id: 'worker',
        accessorKey: 'workerDisplayName',
        header: t('docExpiry.table.worker'),
        cell: ({ row }) => <span className="font-medium">{row.original.workerDisplayName}</span>,
      },
      {
        id: 'category',
        header: t('docExpiry.table.category'),
        enableSorting: false,
        cell: ({ row }) => categoryLabel(row.original.docCategory),
      },
      {
        id: 'expiresAt',
        accessorKey: 'expiresAt',
        header: t('docExpiry.table.expiresAt'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.expiresAt)}</span>
        ),
      },
      {
        id: 'daysUntil',
        accessorKey: 'daysUntilExpiry',
        header: t('docExpiry.table.daysUntil'),
        cell: ({ row }) => {
          const days = row.original.daysUntilExpiry;
          const tone = days < 0 ? 'text-destructive' : days <= 30 ? 'text-warning' : '';
          return <span className={`tabular-nums font-medium ${tone}`}>{days}</span>;
        },
      },
      {
        id: 'band',
        header: t('docExpiry.table.band'),
        enableSorting: false,
        cell: ({ row }) => {
          const band = row.original.band;
          const badgeClass = band === 'later' ? '' : (BAND_BADGE[band as SummaryBand] ?? '');
          return (
            <Badge variant="outline" className={badgeClass}>
              {t(`docExpiry.bands.${band}`)}
            </Badge>
          );
        },
      },
    ],
    [t, categoryLabel, formatDate],
  );

  return (
    <HrSectionCard title={t('docExpiry.title')} description={t('docExpiry.description')}>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUMMARY_BANDS.map(band => (
            <div key={band} className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t(`docExpiry.bands.${band}`)}</dt>
              <dd className={`text-2xl font-semibold tabular-nums ${BAND_TONE[band]}`}>
                {byBand[band]}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-muted-foreground">{t('docExpiry.sectionNote')}</p>

        <WorkbenchDataTable
          sectionClassName=""
          columns={columns}
          data={rows}
          totalRows={rows.length}
          clientPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={setPageIndex}
          onPageSizeChange={handlePageSizeChange}
          entityLabel={t('docExpiry.table.entityLabel', { count: rows.length })}
          emptyTitle={t('docExpiry.table.empty')}
          noResultsTitle={t('docExpiry.table.noResults')}
        />
      </div>
    </HrSectionCard>
  );
}

export function HrDocExpirySection() {
  const t = useTranslations('HrDashboard');
  const { formatDate } = useDateFormatter();
  const docExpiry = useHrDocExpiry();

  if (docExpiry.isLoading) return <HrSectionSkeleton title={t('docExpiry.title')} />;
  if (docExpiry.isError) {
    return (
      <HrSectionError
        title={t('docExpiry.title')}
        heading={t('loadError.heading')}
        body={t('loadError.body')}
        retryLabel={t('loadError.retry')}
        onRetry={docExpiry.onRetry}
      />
    );
  }
  if (docExpiry.isEmpty) {
    return (
      <HrSectionEmpty
        title={t('docExpiry.title')}
        icon={FileWarning}
        heading={t('docExpiry.empty.heading')}
        body={t('docExpiry.empty.body')}
      />
    );
  }

  return (
    <HrDocExpiryView items={docExpiry.items} byBand={docExpiry.byBand} formatDate={formatDate} />
  );
}
