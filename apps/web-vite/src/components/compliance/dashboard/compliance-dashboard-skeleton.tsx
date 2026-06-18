import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

/**
 * Section-shaped loading state for the admin compliance dashboard: three KPI
 * card skeletons over a table skeleton. Matches the eventual layout so the page
 * does not pop between loading shapes.
 */
export function ComplianceDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-live="polite">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-4">
        <Skeleton className="mb-4 h-6 w-40" />
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="mb-2 h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
