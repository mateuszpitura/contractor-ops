/**
 * NotificationPopover — bell icon in the top bar with unread badge +
 * 10-item dropdown.
 *
 * Presentational: receives state + handlers via the `popover` prop bag
 * shaped by `useNotificationPopover`. Owns no tRPC/React Query.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Bell, BellOff, CheckCheck } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { NotificationData } from './notification-item.js';
import { NotificationItem } from './notification-item.js';
import { NotificationPopoverSkeletons } from './notification-popover-skeletons.js';

export interface NotificationPopoverProps {
  unreadCount: number;
  notifications: readonly NotificationData[];
  isLoading: boolean;
  isMarkingRead: boolean;
  isMarkingAllRead: boolean;
  handleItemClick: (notification: NotificationData) => void;
  handleOpenChange: (open: boolean) => void;
  handleViewAll: () => void;
  handleMarkAllRead: () => void;
}

export function NotificationPopover({ popover }: { popover: NotificationPopoverProps }) {
  const t = useTranslations('Notifications');
  const tAria = useTranslations('Common.aria');
  const {
    unreadCount,
    notifications,
    isLoading,
    isMarkingRead,
    isMarkingAllRead,
    handleItemClick,
    handleOpenChange,
    handleViewAll,
    handleMarkAllRead,
  } = popover;

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            aria-label={
              unreadCount > 0
                ? tAria('notificationsWithUnread', { title: t('title'), count: unreadCount })
                : t('title')
            }
          />
        }>
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-live="polite"
            aria-atomic="true"
            className="absolute -end-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
            {badgeText}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">{t('title')}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={handleMarkAllRead}
              disabled={isMarkingAllRead}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
              <CheckCheck className="h-3 w-3" aria-hidden="true" />
              {t('markAllRead')}
            </button>
          )}
        </div>

        {isLoading ? (
          <NotificationPopoverSkeletons />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <BellOff className="h-8 w-8 text-muted-foreground" />
            <span className="mt-2 text-sm text-muted-foreground">{t('empty')}</span>
          </div>
        ) : (
          <>
            <div className="max-h-[360px] overflow-y-auto">
              <div className="flex flex-col">
                {notifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() => handleItemClick(n)}
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
                onClick={handleViewAll}
                className="text-xs text-primary hover:underline">
                {t('viewAll')}
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
