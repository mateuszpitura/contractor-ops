/**
 * NotificationPopoverShell — bell trigger + popover chrome (header + content
 * wrapper). Presentational: receives the badge count, mark-all controls, the
 * open-change handler, and a `children` slot for the variant body
 * (skeletons, empty, or list) chosen by `NotificationPopoverContainer`.
 *
 * Single render path — variant selection lives in the container per the
 * web-vite container-decision rule.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Bell, CheckCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useNotificationPopover } from './hooks/use-notification-popover.js';
import { NotificationPopoverEmpty } from './notification-popover-empty.js';
import { NotificationPopoverList } from './notification-popover-list.js';
import { NotificationPopoverSkeletons } from './notification-popover-skeletons.js';

export interface NotificationPopoverShellProps {
  unreadCount: number;
  isMarkingAllRead: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAllRead: () => void;
  children: ReactNode;
}

export function NotificationPopoverShell({
  unreadCount,
  isMarkingAllRead,
  onOpenChange,
  onMarkAllRead,
  children,
}: NotificationPopoverShellProps) {
  const t = useTranslations('Notifications');
  const tAria = useTranslations('Common.aria');

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Popover onOpenChange={onOpenChange}>
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
              onClick={onMarkAllRead}
              disabled={isMarkingAllRead}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
              <CheckCheck className="h-3 w-3" aria-hidden="true" />
              {t('markAllRead')}
            </button>
          )}
        </div>

        {children}
      </PopoverContent>
    </Popover>
  );
}

export function NotificationPopover() {
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
