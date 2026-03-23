"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { LayoutDashboard } from "lucide-react";

import { trpc } from "@/trpc/init";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SpendChart } from "@/components/dashboard/spend-chart";
import { DeadlinesWidget } from "@/components/dashboard/deadlines-widget";
import { ApprovalQueueWidget } from "@/components/dashboard/approval-queue-widget";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";

// ---------------------------------------------------------------------------
// Error boundary wrapper for individual widgets
// ---------------------------------------------------------------------------

function WidgetErrorFallback({ name }: { name: string }) {
  const t = useTranslations("Dashboard");
  return (
    <div className="flex h-[200px] flex-col items-center justify-center rounded-xl border bg-card p-6 text-center">
      <p className="text-sm text-destructive">
        {t("errors.widgetFailed", { name })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state when all KPIs are zero
// ---------------------------------------------------------------------------

function DashboardEmptyState() {
  const t = useTranslations("Dashboard.emptyState");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <LayoutDashboard className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-[20px] font-semibold">{t("heading")}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("body")}
      </p>
      <Button render={<Link href="/contractors?action=new" />} className="mt-6">
        {t("cta")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard content (needs Suspense for nuqs)
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { can } = usePermissions();
  const hasReportAccess = can("report", ["read"]);

  // Fetch KPIs to check for empty state
  const { data: kpis, isLoading: kpisLoading } = useQuery(
    trpc.dashboard.kpis.queryOptions(),
  );

  // Check if everything is zero (empty org)
  const isEmpty =
    !kpisLoading &&
    kpis &&
    kpis.activeContractors.value === 0 &&
    kpis.pendingApprovals.value === 0 &&
    kpis.readyToPayTotal.valueGrosze === 0 &&
    kpis.expiringContracts.value === 0 &&
    kpis.openTasks.value === 0;

  if (isEmpty) {
    return <DashboardEmptyState />;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* KPI cards row */}
      <KpiCards />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {hasReportAccess && <SpendChart />}
          <DeadlinesWidget />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <OnboardingChecklist />
          <ApprovalQueueWidget />
          <ActivityFeed />
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
 * Shows 5 KPI cards, spend chart, deadlines, approval queue, and activity feed.
 * Wrapped in Suspense for nuqs URL state (SpendChart).
 */
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
