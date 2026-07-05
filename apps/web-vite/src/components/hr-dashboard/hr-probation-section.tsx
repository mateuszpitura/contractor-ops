import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useDateFormatter } from '../../hooks/use-date-formatter.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';
import type { ProbationItem } from './hooks/use-hr-probation.js';
import { useHrProbation } from './hooks/use-hr-probation.js';
import { HrSectionCard, HrSectionEmpty, HrSectionError, HrSectionSkeleton } from './hr-section.js';

type Severity = 'dueToday' | 'dueWithin7' | 'dueWithin14';

interface ProbationRow extends ProbationItem {
  severity: Severity;
}

const SEVERITY_TONE: Record<Severity, string> = {
  dueToday: 'text-destructive',
  dueWithin7: 'text-warning',
  dueWithin14: 'text-muted-foreground',
};

const SEVERITY_BADGE: Record<Severity, string> = {
  dueToday: 'border-destructive/40 bg-destructive/10 text-destructive',
  dueWithin7: 'border-warning/40 bg-warning/10 text-warning',
  dueWithin14: '',
};

export interface HrProbationViewProps {
  dueToday: readonly ProbationItem[];
  dueWithin7: readonly ProbationItem[];
  dueWithin14: readonly ProbationItem[];
  formatDate: (value: Date | string | null | undefined) => string;
}

/** Presentational probation watchlist (HR-DASH-04). Props-in → JSX-out. */
export function HrProbationView({
  dueToday,
  dueWithin7,
  dueWithin14,
  formatDate,
}: HrProbationViewProps) {
  const t = useTranslations('HrDashboard');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const buckets = useMemo<Array<{ severity: Severity; items: readonly ProbationItem[] }>>(
    () => [
      { severity: 'dueToday', items: dueToday },
      { severity: 'dueWithin7', items: dueWithin7 },
      { severity: 'dueWithin14', items: dueWithin14 },
    ],
    [dueToday, dueWithin7, dueWithin14],
  );

  // Most-urgent first (due today at the top), preserving each bucket's ascending sort.
  const rows = useMemo<ProbationRow[]>(
    () =>
      buckets.flatMap(bucket => bucket.items.map(item => ({ ...item, severity: bucket.severity }))),
    [buckets],
  );

  const columns = useMemo<ColumnDef<ProbationRow, unknown>[]>(
    () => [
      {
        id: 'worker',
        accessorKey: 'displayName',
        header: t('probation.table.worker'),
        cell: ({ row }) => <span className="font-medium">{row.original.displayName}</span>,
      },
      {
        id: 'probationEnds',
        accessorKey: 'probationEndsAt',
        header: t('probation.table.probationEnds'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.probationEndsAt)}</span>
        ),
      },
      {
        id: 'daysRemaining',
        accessorKey: 'daysRemaining',
        header: t('probation.table.daysRemaining'),
        cell: ({ row }) => (
          <span className={`tabular-nums font-medium ${SEVERITY_TONE[row.original.severity]}`}>
            {row.original.daysRemaining}
          </span>
        ),
      },
      {
        id: 'severity',
        header: t('probation.table.severity'),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="outline" className={SEVERITY_BADGE[row.original.severity]}>
            {t(`probation.buckets.${row.original.severity}`)}
          </Badge>
        ),
      },
    ],
    [t, formatDate],
  );

  return (
    <HrSectionCard title={t('probation.title')} description={t('probation.description')}>
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-3">
          {buckets.map(bucket => (
            <div key={bucket.severity} className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">
                {t(`probation.buckets.${bucket.severity}`)}
              </dt>
              <dd
                className={`text-2xl font-semibold tabular-nums ${SEVERITY_TONE[bucket.severity]}`}>
                {bucket.items.length}
              </dd>
            </div>
          ))}
        </dl>

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
          entityLabel={t('probation.table.entityLabel', { count: rows.length })}
          emptyTitle={t('probation.table.empty')}
          noResultsTitle={t('probation.table.noResults')}
        />
      </div>
    </HrSectionCard>
  );
}

export function HrProbationSection() {
  const t = useTranslations('HrDashboard');
  const { formatDate } = useDateFormatter();
  const probation = useHrProbation();

  if (probation.isLoading) return <HrSectionSkeleton title={t('probation.title')} />;
  if (probation.isError) {
    return (
      <HrSectionError
        title={t('probation.title')}
        heading={t('loadError.heading')}
        body={t('loadError.body')}
        retryLabel={t('loadError.retry')}
        onRetry={probation.onRetry}
      />
    );
  }
  if (probation.isEmpty) {
    return (
      <HrSectionEmpty
        title={t('probation.title')}
        icon={CalendarClock}
        heading={t('probation.empty.heading')}
        body={t('probation.empty.body')}
      />
    );
  }

  return (
    <HrProbationView
      dueToday={probation.dueToday}
      dueWithin7={probation.dueWithin7}
      dueWithin14={probation.dueWithin14}
      formatDate={formatDate}
    />
  );
}
