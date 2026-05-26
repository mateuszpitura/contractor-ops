import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

interface PageTableSkeletonProps {
  /** Number of skeleton rows in the table card. Defaults to 8. */
  rowCount?: number;
}

/**
 * Unified Suspense-fallback skeleton for data-table pages.
 */
export function PageTableSkeleton({ rowCount = 8 }: PageTableSkeletonProps = {}) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-10 w-60" />
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            key={`chip-${i}`}
            className="h-8 w-24 rounded-full"
          />
        ))}
      </div>
      <Skeleton className="h-9 w-80" />
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            key={`row-${i}`}
            className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
