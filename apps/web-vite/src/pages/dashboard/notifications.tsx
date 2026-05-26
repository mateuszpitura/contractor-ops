/**
 * Notifications page — thin route shell.
 */

import { Suspense } from 'react';

import { NotificationCenterContainer } from '../../components/notifications/notification-center-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <NotificationCenterContainer />
    </Suspense>
  );
}
