import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarOff, TimerOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { numberLocaleTag } from '../saudization/format-locale.js';
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';
import type { WorkerUtilizationRow } from './hooks/use-hr-utilization.js';
import { useHrUtilization } from './hooks/use-hr-utilization.js';
import { HrSectionCard, HrSectionEmpty, HrSectionError, HrSectionSkeleton } from './hr-section.js';

export interface HrUtilizationViewProps {
  items: readonly WorkerUtilizationRow[];
  underUtilizedCount: number;
}

/** Presentational vacation-utilization (HR-DASH-02). Props-in → JSX-out. */
export function HrUtilizationView({ items, underUtilizedCount }: HrUtilizationViewProps) {
  const t = useTranslations('HrDashboard');
  const locale = useLocale();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const dayFormatter = useMemo(
    () => new Intl.NumberFormat(numberLocaleTag(locale), { maximumFractionDigits: 1 }),
    [locale],
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const rows = useMemo(() => [...items], [items]);

  const columns = useMemo<ColumnDef<WorkerUtilizationRow, unknown>[]>(
    () => [
      {
        id: 'worker',
        accessorKey: 'workerId',
        header: t('utilization.table.worker'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.workerId}</span>
        ),
      },
      {
        id: 'year',
        accessorKey: 'year',
        header: t('utilization.table.year'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.year}</span>,
      },
      {
        id: 'taken',
        accessorKey: 'takenDays',
        header: t('utilization.table.taken'),
        cell: ({ row }) => (
          <span className="tabular-nums">{dayFormatter.format(row.original.takenDays)}</span>
        ),
      },
      {
        id: 'entitled',
        accessorKey: 'entitledDays',
        header: t('utilization.table.entitled'),
        cell: ({ row }) => (
          <span className="tabular-nums">{dayFormatter.format(row.original.entitledDays)}</span>
        ),
      },
      {
        id: 'unused',
        accessorKey: 'unusedDays',
        header: t('utilization.table.unused'),
        cell: ({ row }) => (
          <span
            className={`tabular-nums ${
              row.original.underUtilized ? 'font-semibold text-warning' : ''
            }`}>
            {dayFormatter.format(row.original.unusedDays)}
          </span>
        ),
      },
    ],
    [t, dayFormatter],
  );

  return (
    <HrSectionCard title={t('utilization.title')} description={t('utilization.description')}>
      <div className="space-y-4">
        {underUtilizedCount > 0 ? (
          <Alert className="border-warning/50 bg-warning/10">
            <TimerOff aria-hidden="true" className="size-4 text-warning" />
            <AlertTitle className="tabular-nums">
              {t('utilization.underUtilized.count', { count: underUtilizedCount })}
            </AlertTitle>
            <AlertDescription>{t('utilization.underUtilized.body')}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">{t('utilization.underUtilized.none')}</p>
        )}

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
          entityLabel={t('utilization.table.entityLabel', { count: rows.length })}
          emptyTitle={t('utilization.table.empty')}
          noResultsTitle={t('utilization.table.noResults')}
        />
      </div>
    </HrSectionCard>
  );
}

export function HrUtilizationSection() {
  const t = useTranslations('HrDashboard');
  const utilization = useHrUtilization();

  if (utilization.isLoading) return <HrSectionSkeleton title={t('utilization.title')} />;
  if (utilization.isError) {
    return (
      <HrSectionError
        title={t('utilization.title')}
        heading={t('loadError.heading')}
        body={t('loadError.body')}
        retryLabel={t('loadError.retry')}
        onRetry={utilization.onRetry}
      />
    );
  }
  if (utilization.isEmpty) {
    return (
      <HrSectionEmpty
        title={t('utilization.title')}
        icon={CalendarOff}
        heading={t('utilization.degraded.heading')}
        body={t('utilization.degraded.body')}
      />
    );
  }

  return (
    <HrUtilizationView
      items={utilization.items}
      underUtilizedCount={utilization.underUtilizedCount}
    />
  );
}
