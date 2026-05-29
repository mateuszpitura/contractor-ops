/**
 * List body rendered inside `NotificationPopoverShell` when the popover has
 * notifications to show. Presentational: takes the row data + handlers and
 * renders `NotificationItem` rows plus the "view all" footer.
 */

import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { NotificationData } from './notification-item.js';
import { NotificationItem } from './notification-item.js';

interface NotificationPopoverItemProps {
  notification: NotificationData;
  onItemClick: (notification: NotificationData) => void;
  disabled: boolean;
}

function NotificationPopoverItem({
  notification,
  onItemClick,
  disabled,
}: NotificationPopoverItemProps) {
  const handleClick = useCallback(() => onItemClick(notification), [onItemClick, notification]);
  return (
    <NotificationItem
      notification={notification}
      onClick={handleClick}
      compact
      disabled={disabled}
    />
  );
}

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
            <NotificationPopoverItem
              key={n.id}
              notification={n}
              onItemClick={onItemClick}
              disabled={isMarkingRead}
            />
          ))}
        </div>
      </div>

      <div className="border-t px-4 py-2 text-center">
        <button type="button" onClick={onViewAll} className="text-xs text-primary hover:underline">
          {t('viewAll')}
        </button>
      </div>
    </>
  );
}
