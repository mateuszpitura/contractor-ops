"use client";

import { Suspense } from "react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col rounded-lg border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-60" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Full notifications page at /notifications.
 * Wrapped in Suspense for nuqs useSearchParams usage.
 */
export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsLoading />}>
      <NotificationCenter />
    </Suspense>
  );
}
