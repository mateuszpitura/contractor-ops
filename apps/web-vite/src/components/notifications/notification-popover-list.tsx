/**
 * List body rendered inside `NotificationPopoverShell` when the popover has
 * notifications to show. Presentational: takes the row data + handlers and
 * renders `NotificationItem` rows plus the "view all" footer.
 */

import { useTranslations } from '../../i18n/useTranslations.js';
import type { NotificationData } from './notification-item.js';
import { NotificationItem } from './notification-item.js';

export interface NotificationPopoverListProps {
  notifications: readonly NotificationData[];
  isMarkingRead: boolean;
  onItemClick: (notification: NotificationData) => void;
  onViewAll: () => void;
}

export function NotificationPopoverList({
  notifications,
  isMarkingRead,
  onItemClick,
  onViewAll,
}: NotificationPopoverListProps) {
  const t = useTranslations('Notifications');
  return (
    <>
      <div className="max-h-[360px] overflow-y-auto">
        <div className="flex flex-col">
          {notifications.map(n => (
            <NotificationItem
              key={n.id}
              notification={n}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => onItemClick(n)}
              compact
              disabled={isMarkingRead}
            />
          ))}
        </div>
      </div>

      <div className="border-t px-4 py-2 text-center">
        <button
          type="button"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={onViewAll}
          className="text-xs text-primary hover:underline">
          {t('viewAll')}
        </button>
      </div>
    </>
  );
}
