/**
 * Presentational skeleton list used by `NotificationCenterContainer`
 * while the paginated notification query resolves.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6'] as const;

export function NotificationCenterSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border">
      {SKELETON_ROW_KEYS.map(key => (
        <div key={key} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-60" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
