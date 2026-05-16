'use client';

import { AtelierBackground, DashboardIllustration } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { ApprovalQueueWidget } from '@/components/dashboard/approval-queue-widget';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { DeadlinesWidget } from '@/components/dashboard/deadlines-widget';
import { HeroSpendMetric } from '@/components/dashboard/hero-spend-metric';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { OverdueReceivablesTile } from '@/components/dashboard/overdue-receivables-tile';
import { SpendChart } from '@/components/dashboard/spend-chart';
import { TaxObligationsWidget } from '@/components/dashboard/tax-obligations-widget';
import { EInvoiceComplianceWidget } from '@/components/einvoice/compliance-widget';
import { useFlag } from '@/components/layout/feature-flag-context';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Dashboard skeleton — shared between Suspense fallback & KPI loading gate
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-md" />
      </div>
      <Skeleton className="h-[200px] w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`skel-${i}`} className="h-[120px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[340px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state when all KPIs are zero
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Dashboard content (needs Suspense for nuqs)
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { can } = usePermissions();
  const hasReportAccess = can('report', ['read']);
  const lateInterestEnabled = useFlag('payments.late-interest-enabled');
  const classificationEnabled = useFlag('module.classification-engine');

  // Fetch a single bundled bootstrap payload (KPIs + spendTrend + deadlines +
  // activity) so the dashboard entry-point makes one batched round-trip
  // instead of seven independent widget calls. The bootstrap procedure shares
  // the same Redis cache slots as the per-widget queries, so leaf widgets
  // that still call their own procedures continue to work without
  // double-spending cache entries (see dashboard.bootstrap JSDoc).
  const { data: bootstrap, isLoading: bootstrapLoading } = useQuery(
    trpc.dashboard.bootstrap.queryOptions({ spendMonths: '6' }),
  );
  const kpis = bootstrap?.kpis;

  // While the bootstrap payload is loading, show the skeleton fallback to avoid
  // a flash of individual widget skeletons that then snap to the empty state.
  if (bootstrapLoading) {
    return <DashboardSkeleton />;
  }

  // Check if everything is zero (empty org)
  const isEmpty =
    kpis &&
    kpis.activeContractors.value === 0 &&
    kpis.pendingApprovals.value === 0 &&
    kpis.readyToPayTotal.valueMinor === 0 &&
    kpis.expiringContracts.value === 0 &&
    kpis.openTasks.value === 0;

  if (isEmpty) {
    return <DashboardEmptyState />;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting with gradient text */}
      <AnimateIn delay={0}>
        <DashboardGreeting />
      </AnimateIn>

      {/* Hero spend metric — full-width, gated on report:read */}
      {hasReportAccess && (
        <AnimateIn delay={1}>
          <HeroSpendMetric />
        </AnimateIn>
      )}

      {/* KPI bento grid */}
      <AnimateIn delay={2}>
        <KpiCards />
      </AnimateIn>

      {/* Two-column layout — items-start keeps columns top-aligned */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {hasReportAccess && (
            <AnimateIn delay={3}>
              <SpendChart />
            </AnimateIn>
          )}
          <AnimateIn delay={4}>
            <DeadlinesWidget />
          </AnimateIn>
        </div>

        {/* Right column */}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Dashboard home page.
 *
 * Wrapped in `<AtelierIntensityProvider value="atelier">` so any leaf
 * primitive from @contractor-ops/ui (TiltCard, Sparkline, etc.) gets
 * the dashboard tier defaults — premium surfaces, animated motion,
 * hero glow allowed. Operational pages (contractors, invoices,
 * payments…) wrap in `value="workbench"` to self-downgrade.
 *
 * Layout (decision locked in §8 of UI-ATELIER-WORKPLAN.md):
 *
 *   - DashboardGreeting
 *   - HeroSpendMetric (full-width, hasReportAccess only)
 *   - KpiCards (5-card bento grid)
 *   - SpendChart | ApprovalQueueWidget
 *     DeadlinesWidget | OverdueReceivablesTile
 *                       ActivityFeed
 *                       EInvoiceComplianceWidget
 *                       TaxObligationsWidget
 *   - OnboardingChecklist (right column, top)
 *
 * Wrapped in Suspense for nuqs URL state (SpendChart).
 */
export default function DashboardPage() {
  // Intensity tier (atelier) is provided by the layout-level
  // IntensityRouter, so the AtelierBackground rendered here picks up
  // the right behavior automatically (it would self-disable on
  // workbench routes).
  return (
    <div className="relative">
      <AtelierBackground />
      <div className="relative z-10">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </div>
    </div>
  );
}
