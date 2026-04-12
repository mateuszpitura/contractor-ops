'use client';

import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { ApprovalQueueWidget } from '@/components/dashboard/approval-queue-widget';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { DeadlinesWidget } from '@/components/dashboard/deadlines-widget';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { SpendChart } from '@/components/dashboard/spend-chart';
import { TaxObligationsWidget } from '@/components/dashboard/tax-obligations-widget';
import { EInvoiceComplianceWidget } from '@/components/einvoice/compliance-widget';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Empty state when all KPIs are zero
// ---------------------------------------------------------------------------

function DashboardEmptyState() {
  const t = useTranslations('Dashboard.emptyState');

  return (
    <div className="dot-grid corner-marks flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-border/40 text-center">
      <div className="flex flex-col items-center px-6 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <LayoutDashboard className="h-8 w-8 text-primary" />
        </div>
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

  // Fetch KPIs to check for empty state
  const { data: kpis, isLoading: kpisLoading } = useQuery(trpc.dashboard.kpis.queryOptions());

  // Check if everything is zero (empty org)
  const isEmpty =
    !kpisLoading &&
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

      {/* Accent line separator */}
      <AnimateIn delay={0}>
        <div className="accent-line w-full rounded-full" />
      </AnimateIn>

      {/* KPI bento grid */}
      <AnimateIn delay={1}>
        <KpiCards />
      </AnimateIn>

      {/* Two-column layout — items-start keeps columns top-aligned */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {hasReportAccess && (
            <AnimateIn delay={2}>
              <SpendChart />
            </AnimateIn>
          )}
          <AnimateIn delay={3}>
            <DeadlinesWidget />
          </AnimateIn>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <OnboardingChecklist />
          <AnimateIn delay={2}>
            <ApprovalQueueWidget />
          </AnimateIn>
          <AnimateIn delay={3}>
            <ActivityFeed />
          </AnimateIn>
          <AnimateIn delay={4}>
            <EInvoiceComplianceWidget />
          </AnimateIn>
          <AnimateIn delay={5}>
            <TaxObligationsWidget />
          </AnimateIn>
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
 * Shows greeting, 5 KPI cards, spend chart, deadlines, approval queue, and
 * activity feed. Wrapped in Suspense for nuqs URL state (SpendChart).
 */
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-8">
          <div className="space-y-1">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-[100px] rounded-xl" />
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
      }>
      <DashboardContent />
    </Suspense>
  );
}
