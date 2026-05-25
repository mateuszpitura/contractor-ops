/**
 * Presentational skeleton placeholder used by `NotificationPopover` while
 * the unread-list query resolves.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

export function NotificationPopoverSkeletons() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={`skel-${i}`} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
