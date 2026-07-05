/**
 * Manager team overview — the caller's direct reports with a pending-leave count
 * each. Reports are resolved server-side (96-06); a non-manager is FORBIDDEN and
 * renders a forbidden state, never a crash. Presentational view only; the tRPC
 * boundary is `use-manager-overview`.
 */

import { AlertCircle, ShieldOff, Users } from 'lucide-react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { SectionCard, SectionMessage, SectionSkeleton } from '../employee-section-shell.js';
import type { ManagerTeamReport } from './hooks/use-manager-overview.js';
import { useManagerOverview } from './hooks/use-manager-overview.js';

interface ManagerOverviewViewProps {
  reports: ManagerTeamReport[];
}

export function ManagerOverviewView({ reports }: ManagerOverviewViewProps) {
  const t = useTranslations('Portal.employee.team.overview');

  return (
    <SectionCard icon={Users} title={t('title')} description={t('description')}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {reports.map(report => (
          <li
            key={report.workerId}
            className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5">
            <span className="truncate text-sm font-medium">
              {report.displayName ?? t('unnamedReport')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('pendingLeave', { count: report.pendingLeaveCount })}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function ManagerOverview() {
  const t = useTranslations('Portal.employee.team.overview');
  const overview = useManagerOverview();

  if (overview.isLoading) return <SectionSkeleton rows={3} />;
  if (overview.isForbidden) {
    return (
      <SectionCard icon={ShieldOff} title={t('title')}>
        <SectionMessage icon={ShieldOff} title={t('forbiddenTitle')} description={t('forbidden')} />
      </SectionCard>
    );
  }
  if (overview.isError) {
    return (
      <SectionCard icon={Users} title={t('title')}>
        <SectionMessage
          icon={AlertCircle}
          tone="danger"
          title={t('errorTitle')}
          description={t('error')}
        />
      </SectionCard>
    );
  }
  if (overview.isEmpty) {
    return (
      <SectionCard icon={Users} title={t('title')} description={t('description')}>
        <SectionMessage icon={Users} title={t('emptyTitle')} description={t('empty')} />
      </SectionCard>
    );
  }

  return <ManagerOverviewView reports={overview.reports} />;
}
