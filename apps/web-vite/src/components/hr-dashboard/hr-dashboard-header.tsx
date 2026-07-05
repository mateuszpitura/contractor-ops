import { AnimatedNumber } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { LucideIcon } from 'lucide-react';
import { CalendarClock, FileWarning, TimerOff, Users } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { HrSummary } from './hooks/use-hr-summary.js';
import { useHrSummary } from './hooks/use-hr-summary.js';
import { HrSectionEmpty, HrSectionError } from './hr-section.js';

interface KpiStat {
  key: keyof HrSummary;
  labelKey: string;
  icon: LucideIcon;
  /** Draw attention when the count is non-zero (action-needed KPIs). */
  emphasizeWhenSet: boolean;
}

const KPI_STATS: KpiStat[] = [
  {
    key: 'totalHeadcount',
    labelKey: 'header.totalHeadcount',
    icon: Users,
    emphasizeWhenSet: false,
  },
  {
    key: 'underUtilizedCount',
    labelKey: 'header.underUtilized',
    icon: TimerOff,
    emphasizeWhenSet: true,
  },
  {
    key: 'probationDueCount',
    labelKey: 'header.probationDue',
    icon: CalendarClock,
    emphasizeWhenSet: true,
  },
  {
    key: 'expiringDocCount',
    labelKey: 'header.expiringDocs',
    icon: FileWarning,
    emphasizeWhenSet: true,
  },
];

export interface HrDashboardHeaderViewProps {
  values: Record<KpiStat['key'], number>;
}

/** Presentational KPI header — four read-only summary stats. */
export function HrDashboardHeaderView({ values }: HrDashboardHeaderViewProps) {
  const t = useTranslations('HrDashboard');

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_STATS.map(stat => {
        const value = values[stat.key];
        const emphasize = stat.emphasizeWhenSet && value > 0;
        const Icon = stat.icon;
        return (
          <div
            key={stat.key}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon aria-hidden="true" className={`size-4 ${emphasize ? 'text-warning' : ''}`} />
              {t(stat.labelKey)}
            </dt>
            <dd
              className={`font-display text-3xl font-semibold tabular-nums ${
                emphasize ? 'text-warning' : ''
              }`}>
              <AnimatedNumber value={value} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function HrDashboardHeaderSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {KPI_STATS.map(stat => (
        <Skeleton key={stat.key} className="h-[104px] rounded-xl" />
      ))}
    </div>
  );
}

export function HrDashboardHeader() {
  const t = useTranslations('HrDashboard');
  const summary = useHrSummary();

  if (summary.isLoading) return <HrDashboardHeaderSkeleton />;
  if (summary.isError) {
    return (
      <HrSectionError
        title={t('header.title')}
        heading={t('loadError.heading')}
        body={t('loadError.body')}
        retryLabel={t('loadError.retry')}
        onRetry={summary.onRetry}
      />
    );
  }
  if (summary.isEmpty) {
    return (
      <HrSectionEmpty
        title={t('header.title')}
        icon={Users}
        heading={t('header.empty.heading')}
        body={t('header.empty.body')}
      />
    );
  }

  return (
    <HrDashboardHeaderView
      values={{
        totalHeadcount: summary.kpiProps.totalHeadcount,
        underUtilizedCount: summary.kpiProps.underUtilizedCount,
        probationDueCount: summary.kpiProps.probationDueCount,
        expiringDocCount: summary.kpiProps.expiringDocCount,
      }}
    />
  );
}
