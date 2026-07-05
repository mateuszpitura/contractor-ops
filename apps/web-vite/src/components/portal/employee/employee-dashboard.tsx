/**
 * Employee self-service dashboard — the /portal/employee home. Renders a summary
 * strip from `use-employee-dashboard` and composes the independently-wired leave,
 * time, documents, and pay sections (each owns its own data + states). When the
 * whole module is dark, a single page-level unavailable state is shown.
 */

import { AlertCircle, CalendarClock, Clock, Plane, ShieldOff } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { AnimateIn } from '../../shared/animate-in.js';
import { SummaryCard, SummaryCardSkeleton } from '../summary-card.js';
import { EmployeeDocumentsSection } from './employee-documents-section.js';
import { EmployeeLeaveSection } from './employee-leave-section.js';
import { EmployeePaySection } from './employee-pay-section.js';
import { SectionCard, SectionMessage } from './employee-section-shell.js';
import { EmployeeTimeSection } from './employee-time-section.js';
import { useEmployeeDashboard } from './hooks/use-employee-dashboard.js';

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

interface EmployeeDashboardSummaryProps {
  availableMinutes: number;
  pendingLeaveCount: number;
  recentTimeCount: number;
}

export function EmployeeDashboardSummary({
  availableMinutes,
  pendingLeaveCount,
  recentTimeCount,
}: EmployeeDashboardSummaryProps) {
  const t = useTranslations('Portal.employee.dashboard');
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SummaryCard icon={Plane} label={t('availableLeave')} value={formatHours(availableMinutes)} />
      <SummaryCard icon={CalendarClock} label={t('pendingRequests')} value={pendingLeaveCount} />
      <SummaryCard icon={Clock} label={t('recentEntries')} value={recentTimeCount} />
    </div>
  );
}

export function EmployeeDashboard() {
  const t = useTranslations('Portal.employee.dashboard');
  const dashboard = useEmployeeDashboard();

  if (dashboard.isUnavailable) {
    return (
      <SectionCard icon={ShieldOff} title={t('title')}>
        <SectionMessage
          icon={ShieldOff}
          title={t('unavailableTitle')}
          description={t('unavailable')}
        />
      </SectionCard>
    );
  }

  if (dashboard.isError) {
    return (
      <SectionCard icon={AlertCircle} title={t('title')}>
        <SectionMessage
          icon={AlertCircle}
          tone="danger"
          title={t('errorTitle')}
          description={t('error')}
        />
      </SectionCard>
    );
  }

  const availableMinutes = dashboard.balances.reduce(
    (total, balance) =>
      total + balance.entitledMinutes + balance.carryoverMinutes - balance.usedMinutes,
    0,
  );

  return (
    <div className="space-y-6">
      <AnimateIn>
        {dashboard.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>
        ) : (
          <EmployeeDashboardSummary
            availableMinutes={availableMinutes}
            pendingLeaveCount={dashboard.pendingLeaveCount}
            recentTimeCount={dashboard.recentTime.length}
          />
        )}
      </AnimateIn>

      <AnimateIn delay={1}>
        <EmployeeLeaveSection />
      </AnimateIn>
      <AnimateIn delay={2}>
        <EmployeeTimeSection />
      </AnimateIn>
      <AnimateIn delay={3}>
        <EmployeeDocumentsSection />
      </AnimateIn>
      <AnimateIn delay={4}>
        <EmployeePaySection />
      </AnimateIn>
    </div>
  );
}
