import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

const KPI_SKELETON_KEYS = ['spend', 'contractors', 'invoices', 'approvals', 'compliance'] as const;

/**
 * Dashboard loading skeleton — mirrors the bento layout exactly so the
 * page does not reflow when the bootstrap query resolves.
 *
 * Shape contract (greeting → hero spend → KPI bento → 2-column widgets):
 *   - h-8 greeting + h-4 subtitle  → DashboardGreeting
 *   - h-[200px] full-width         → HeroSpendMetric
 *   - 5× h-[120px] bento cells     → KpiCards (xl:grid-cols-4, hero spans 2)
 *   - 2-column lower grid          → SpendChart / DeadlinesWidget
 *                                    ApprovalQueueWidget / OnboardingChecklist
 *                                    ActivityFeed / TaxObligationsWidget /
 *                                    EInvoiceComplianceWidget
 *
 * Used as the route-level `<Suspense>` fallback AND the bootstrap-loading
 * fallback inside `DashboardHomeContainer` — the two states must visually
 * agree to avoid a flash of one skeleton snapping into another.
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-md" />
      </div>
      <Skeleton className="h-[200px] w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {KPI_SKELETON_KEYS.map(key => (
          <Skeleton key={key} className="h-[120px] rounded-2xl" />
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
