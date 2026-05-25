import { useNotificationPopover } from './hooks/use-notification-popover.js';
import { NotificationPopover } from './notification-popover.js';

export function NotificationPopoverContainer() {
  const popover = useNotificationPopover();
  return <NotificationPopover popover={popover} />;
}
