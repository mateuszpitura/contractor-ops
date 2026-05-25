import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

/** Header shimmer matching the rendered detail header layout. */
export function DetailHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-[240px]" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="size-7" />
      </div>
    </div>
  );
}

/** Tab strip + 2-column card shimmer. Mirrors the OverviewTab grid. */
export function DetailTabContentSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={`detail-tab-skel-${i}`} className="rounded-xl border bg-card p-4">
          <Skeleton className="mb-3 h-5 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Triggers + content shimmer for the detail tab bar while the contract loads. */
export function DetailTabsSkeleton() {
  return (
    <>
      <div className="mb-4 flex gap-2 border-b pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`detail-tabs-skel-${i}`} className="h-7 w-24" />
        ))}
      </div>
      <DetailTabContentSkeleton />
    </>
  );
}
