'use client';

import { Suspense } from 'react';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { PageLoadingSpinner } from '@/components/shared/page-loading-spinner';

/**
 * Full notifications page at /notifications.
 * Wrapped in Suspense for nuqs useSearchParams usage.
 */
export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <NotificationCenter />
    </Suspense>
  );
}
