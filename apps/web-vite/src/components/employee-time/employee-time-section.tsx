import {
  AtelierEmptyState,
  DataTable,
  QueryErrorPanel,
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Clock, ShieldCheck, Timer, TrendingUp, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { SummaryCard, SummaryCardSkeleton } from '../portal/summary-card.js';
import { EmployeeTimeEntryView } from './employee-time-entry-view.js';
import type { LimitStatus } from './hooks/use-employee-time.js';
import { minutesToHours, useEmployeeTime } from './hooks/use-employee-time.js';
import { WtLimitWarningBanner } from './wt-limit-warning-banner.js';

type EmployeeTimeRecordRow = ReturnType<typeof useEmployeeTime>['records'][number];

function formatHours(minutes: number): string {
  return `${minutesToHours(minutes)}h`;
}

const LIMIT_META: Record<LimitStatus, { icon: typeof ShieldCheck; key: string }> = {
  within: { icon: ShieldCheck, key: 'withinLimit' },
  approaching: { icon: AlertTriangle, key: 'approaching' },
  breached: { icon: TriangleAlert, key: 'breached' },
};

function getColumns(
  t: ReturnType<typeof useTranslations>,
  tAbsence: ReturnType<typeof useTranslations>,
  locale: string,
): ColumnDef<EmployeeTimeRecordRow>[] {
  const hourCell = (minutes: number) => (
    <span className="block text-end text-sm tabular-nums">{minutesToHours(minutes)}</span>
  );
  const endHeader = (label: string) => () => <span className="block text-end">{label}</span>;

  return [
    {
      id: 'date',
      header: t('date'),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
            new Date(row.original.workDate),
          )}
        </span>
      ),
    },
    {
      id: 'worked',
      header: endHeader(t('worked')),
      cell: ({ row }) => hourCell(row.original.workedMinutes),
    },
    {
      id: 'night',
      header: endHeader(t('night')),
      cell: ({ row }) => hourCell(row.original.nightMinutes),
    },
    {
      id: 'overtime',
      header: endHeader(t('overtime')),
      cell: ({ row }) => hourCell(row.original.overtimeMinutes50 + row.original.overtimeMinutes100),
    },
    {
      id: 'weekendHoliday',
      header: endHeader(t('weekendHoliday')),
      cell: ({ row }) => hourCell(row.original.weekendHolidayMinutes),
    },
    {
      id: 'onCall',
      header: endHeader(t('onCall')),
      cell: ({ row }) => hourCell(row.original.onCallMinutes),
    },
    {
      id: 'absence',
      header: t('absence'),
      cell: ({ row }) =>
        row.original.absenceKind ? (
          <span className="text-sm">{tAbsence(row.original.absenceKind)}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
  ];
}

export function EmployeeTime() {
  const time = useEmployeeTime();
  const t = useTranslations('EmployeeTime');
  const tColumns = useTranslations('EmployeeTime.columns');
  const tSummary = useTranslations('EmployeeTime.summary');
  const tAbsence = useTranslations('EmployeeTime.absenceKind');
  const locale = useLocale();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo(
    () => getColumns(tColumns, tAbsence, locale),
    [tColumns, tAbsence, locale],
  );

  const limitMeta = LIMIT_META[time.summary.limitStatus];
  const LimitIcon = limitMeta.icon;

  const handleWorkerChange = useCallback(
    (value: string | null) => time.onWorkerChange(value ?? ''),
    [time],
  );

  if (time.isError) {
    return (
      <div className={WORKBENCH_TABLE_SECTION_CLASS}>
        <QueryErrorPanel
          message={t('error.loadMessage')}
          retryLabel={t('error.retry')}
          onRetry={time.onRetry}
        />
      </div>
    );
  }

  return (
    <section aria-label={t('sectionLabel')} className={WORKBENCH_TABLE_SECTION_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionLabel icon={Timer}>{t('sectionLabel')}</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={time.workerId} onValueChange={handleWorkerChange}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t('sectionLabel')} />
            </SelectTrigger>
            <SelectContent>
              {time.employeeOptions.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <EmployeeTimeEntryView
            open={time.formOpen}
            onOpenChange={time.onFormOpenChange}
            onSubmit={time.onSaveEntry}
            isSubmitting={time.isSaving}
            disabled={!time.hasWorker}
          />
        </div>
      </div>

      {time.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            icon={Clock}
            label={tSummary('thisWeek')}
            value={formatHours(time.summary.weekMinutes)}
          />
          <SummaryCard
            icon={TrendingUp}
            label={tSummary('overtimeThisMonth')}
            value={formatHours(time.summary.overtimeMonthMinutes)}
          />
          <SummaryCard
            icon={LimitIcon}
            label={tSummary('limitStatus')}
            value={tSummary(limitMeta.key)}
          />
        </div>
      )}

      {time.showBanner ? (
        <WtLimitWarningBanner
          findings={time.findings}
          workerName={time.workerName}
          onDismiss={time.onDismissBanner}
        />
      ) : null}

      {time.isEmpty ? (
        <AtelierEmptyState
          variant="page"
          icon={Timer}
          heading={t('empty.heading')}
          body={t('empty.body')}
          renderAction={() => null}
        />
      ) : !time.isLoading && time.records.length === 0 ? (
        <AtelierEmptyState
          variant="subview"
          icon={Timer}
          heading={t('empty.heading')}
          body={t('empty.body')}
          renderAction={() => null}
        />
      ) : (
        <div className={WORKBENCH_DATA_TABLE_CLASS}>
          <DataTable
            columns={columns}
            data={time.records}
            totalRows={time.records.length}
            entityLabel={t('entityLabel')}
            emptyTitle={t('empty.heading')}
            noResultsTitle={t('empty.heading')}
            isLoading={time.isLoading}
            clientPagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
            getRowId={row => row.id}
          />
        </div>
      )}
    </section>
  );
}
