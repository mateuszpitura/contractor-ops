import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

/** Skeleton grid mirroring the source-selection card layout. */
export function SourceSelectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <Skeleton key={`source-skel-${i}`} className="h-24 w-full" />
      ))}
    </div>
  );
}

/** Skeleton for the people-review table — header bar + 5 row strips. */
export function PeopleReviewSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-12 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <Skeleton key={`people-skel-${i}`} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** Skeleton for the project-import cards section. */
export function ProjectImportSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-64" />
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <Skeleton key={`proj-skel-${i}`} className="h-32 w-full" />
      ))}
    </div>
  );
}
