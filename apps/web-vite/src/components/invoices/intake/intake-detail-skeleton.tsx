import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

/**
 * Layout-stable skeleton for the intake-detail screen — preserves the
 * header + two-column (PDF + side-panels) rhythm so the suspense flip
 * does not jump the layout.
 */
export function IntakeDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Skeleton className="h-[600px] w-full rounded-lg" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
