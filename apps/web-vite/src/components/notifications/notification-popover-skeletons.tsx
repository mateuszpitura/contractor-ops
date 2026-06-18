/**
 * Presentational skeleton placeholder used by `NotificationPopover` while
 * the unread-list query resolves.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

const NOTIFICATION_SKELETON_KEYS = ['n1', 'n2', 'n3', 'n4'] as const;

export function NotificationPopoverSkeletons() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {NOTIFICATION_SKELETON_KEYS.map(key => (
        <div key={key} className="flex items-center gap-3 px-3 py-2">
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
