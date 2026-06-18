import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

const SOURCE_SKELETON_KEYS = ['card-1', 'card-2', 'card-3', 'card-4'] as const;
const PEOPLE_SKELETON_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5'] as const;
const PROJECT_SKELETON_KEYS = ['card-1', 'card-2', 'card-3'] as const;

/** Skeleton grid mirroring the source-selection card layout. */
export function SourceSelectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden="true">
      {SOURCE_SKELETON_KEYS.map(key => (
        <Skeleton key={key} className="h-24 w-full" />
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
      {PEOPLE_SKELETON_KEYS.map(key => (
        <Skeleton key={key} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** Skeleton for the project-import cards section. */
export function ProjectImportSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-64" />
      {PROJECT_SKELETON_KEYS.map(key => (
        <Skeleton key={key} className="h-32 w-full" />
      ))}
    </div>
  );
}
