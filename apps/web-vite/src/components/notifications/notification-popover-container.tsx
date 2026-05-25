/**
 * Top-bar notification popover. Decisive container: picks the popover body
 * variant (loading skeletons, empty state, or notification list) from flags
 * returned by `useNotificationPopover`. The presentational
 * `NotificationPopoverShell` only renders the bell trigger and popover
 * chrome — body is injected via children so the view stays single-path.
 */

import { useNotificationPopover } from './hooks/use-notification-popover.js';
import { NotificationPopoverShell } from './notification-popover.js';
import { NotificationPopoverEmpty } from './notification-popover-empty.js';
import { NotificationPopoverList } from './notification-popover-list.js';
import { NotificationPopoverSkeletons } from './notification-popover-skeletons.js';

export function NotificationPopoverContainer() {
  const popover = useNotificationPopover();

  const body = popover.isLoading ? (
    <NotificationPopoverSkeletons />
  ) : popover.notifications.length === 0 ? (
    <NotificationPopoverEmpty />
  ) : (
    <NotificationPopoverList
      notifications={popover.notifications}
      isMarkingRead={popover.isMarkingRead}
      onItemClick={popover.handleItemClick}
      onViewAll={popover.handleViewAll}
    />
  );

  return (
    <NotificationPopoverShell
      unreadCount={popover.unreadCount}
      isMarkingAllRead={popover.isMarkingAllRead}
      onOpenChange={popover.handleOpenChange}
      onMarkAllRead={popover.handleMarkAllRead}>
      {body}
    </NotificationPopoverShell>
  );
}
