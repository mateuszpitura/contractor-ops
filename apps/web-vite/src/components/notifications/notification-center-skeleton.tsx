/**
 * Presentational skeleton list used by `NotificationCenterContainer`
 * while the paginated notification query resolves.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

export function NotificationCenterSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          key={`skel-${i}`}
          className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
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
