import { DashboardIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { lazy, Suspense } from 'react';

import { usePermissions } from '../../hooks/use-permissions.js';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { EInvoiceComplianceWidget } from '../einvoice/compliance-widget.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { OnboardingChecklist } from '../onboarding/onboarding-checklist.js';
import { AnimateIn } from '../shared/animate-in.js';
import { ActivityFeed } from './activity-feed.js';
import { ApprovalQueueWidget } from './approval-queue-widget.js';
import { DashboardGreeting } from './dashboard-greeting.js';
import { DashboardSkeleton } from './dashboard-skeleton.js';

export { DashboardSkeleton } from './dashboard-skeleton.js';

import { DeadlinesWidget } from './deadlines-widget.js';
import { HeroSpendMetric } from './hero-spend-metric.js';
import { useDashboardHome } from './hooks/use-dashboard-home.js';
import { KpiCards } from './kpi-cards.js';
import { OverdueReceivablesTile } from './overdue-receivables-tile.js';
import { TaxObligationsWidget } from './tax-obligations-widget.js';

/**
 * SpendChart pulls in recharts (+ d3) — the heaviest vendor group on the
 * dashboard. Lazy-load it so the chunk downloads after first paint instead of
 * blocking dashboard interactivity; a skeleton card holds the layout in place.
 */
const SpendChart = lazy(() =>
  import('./spend-chart.js').then(module => ({ default: module.SpendChart })),
);

function SpendChartFallback() {
  return <Skeleton className="h-[420px] w-full rounded-2xl" />;
}

/**
 * Empty state rendered when every KPI is zero — fresh org that hasn't
 * onboarded a contractor yet. Mirrors the legacy `DashboardEmptyState`
 * (commit 62a97d73): centered illustration + heading + body + CTA inside
 * a dot-grid card with corner-mark accents.
 */
function DashboardEmptyState() {
  const t = useTranslations('Dashboard.emptyState');

  return (
    <div className="dot-grid corner-marks flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-border/40 text-center">
      <div className="flex flex-col items-center px-6 py-16">
        <DashboardIllustration className="h-28 w-28" />
        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">{t('heading')}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('body')}</p>
        <Button render={<Link href="/contractors?action=new" />} className="mt-8">
          {t('cta')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Dashboard bento — restored to legacy parity after the Next.js → Vite
 * migration dropped the rich layout in favour of a 5-cell `UsageKpiCard`
 * row. Layout contract (locked in §8 of `docs/UI-ATELIER-WORKPLAN.md`):
 *
 *   - DashboardGreeting
 *   - HeroSpendMetric (full-width, `report:read` only)
 *   - KpiCards (bento with hero-span-2)
 *   - Two-column grid (items-start):
 *       Left:  SpendChart (report:read) · DeadlinesWidget
 *       Right: OnboardingChecklist · ApprovalQueueWidget ·
 *              OverdueReceivablesTile (lateInterest flag) · ActivityFeed ·
 *              EInvoiceComplianceWidget ·
 *              TaxObligationsWidget (classification flag)
 *
 * The bootstrap query lives in `useDashboardHome` so all KPI math is one
 * round trip; per-widget queries reuse the shared Redis cache slots.
 */
export function DashboardHome() {
  const t = useTranslations('Dashboard');
  const { can } = usePermissions();
  const hasReportAccess = can('report', ['read']);
  const lateInterestEnabled = useFlag('payments.late-interest-enabled');
  const classificationEnabled = useFlag('module.classification-engine');
  const { isPending, error, kpis } = useDashboardHome();

  if (isPending) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <main aria-labelledby="dashboard-heading">
        <p role="alert" className="text-destructive">
          {t('errorLoading')}: {String(error)}
        </p>
      </main>
    );
  }

  const isEmpty =
    kpis &&
    kpis.activeContractors.value === 0 &&
    kpis.pendingApprovals.value === 0 &&
    kpis.readyToPayTotal.valueMinor === 0 &&
    kpis.expiringContracts.value === 0 &&
    kpis.openTasks.value === 0;

  if (isEmpty) {
    return (
      <main aria-labelledby="dashboard-heading">
        <DashboardEmptyState />
      </main>
    );
  }

  return (
    <main aria-labelledby="dashboard-heading" className="flex flex-col gap-8">
      <AnimateIn delay={0}>
        <DashboardGreeting />
      </AnimateIn>

      {hasReportAccess && (
        <AnimateIn delay={1}>
          <HeroSpendMetric />
        </AnimateIn>
      )}

      <AnimateIn delay={2}>
        <KpiCards />
      </AnimateIn>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {hasReportAccess && (
            <AnimateIn delay={3}>
              <Suspense fallback={<SpendChartFallback />}>
                <SpendChart />
              </Suspense>
            </AnimateIn>
          )}
          <AnimateIn delay={4}>
            <DeadlinesWidget />
          </AnimateIn>
        </div>

        <div className="flex flex-col gap-6">
          <OnboardingChecklist />
          <AnimateIn delay={3}>
            <ApprovalQueueWidget />
          </AnimateIn>
          <OverdueReceivablesTile featureEnabled={lateInterestEnabled} />
          <AnimateIn delay={4}>
            <ActivityFeed />
          </AnimateIn>
          <AnimateIn delay={5}>
            <EInvoiceComplianceWidget />
          </AnimateIn>
          {classificationEnabled && (
            <AnimateIn delay={5}>
              <TaxObligationsWidget />
            </AnimateIn>
          )}
        </div>
      </div>
    </main>
  );
}
