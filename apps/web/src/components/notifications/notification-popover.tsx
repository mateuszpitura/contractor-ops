'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import type { NotificationData } from './notification-item';
import { getEntityUrl, NotificationItem } from './notification-item';

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function PopoverSkeletons() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`skel-${i}`} className="flex items-center gap-3 px-3 py-2">
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

// ---------------------------------------------------------------------------
// NotificationPopover
// ---------------------------------------------------------------------------

export function NotificationPopover() {
  const t = useTranslations('Notifications');
  const tAria = useTranslations('Common.aria');
  const router = useRouter();
  const queryClient = useQueryClient();

  // Unread count with 30s polling (per D-01 and research Pattern 4)
  const unreadQuery = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const unreadCount = (unreadQuery.data as { count: number } | undefined)?.count ?? 0;

  // List query -- only fetches when popover is open (enabled below is always true,
  // but we refetch on open via the popover onOpenChange)
  const listQuery = useQuery({
    ...trpc.notification.list.queryOptions({ pageSize: 10 }),
    enabled: true,
  });

  const notifications = (listQuery.data as { items: NotificationData[] } | undefined)?.items ?? [];

  // Mark single notification as read
  const markReadMutation = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['notification', 'unreadCount']],
        });
        void queryClient.invalidateQueries({
          queryKey: [['notification', 'list']],
        });
      },
    }),
  );

  // Mark all notifications as read
  const markAllReadMutation = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => {
        toast.success(t('markedAllRead'));
        void queryClient.invalidateQueries({
          queryKey: [['notification', 'unreadCount']],
        });
        void queryClient.invalidateQueries({
          queryKey: [['notification', 'list']],
        });
      },
      onError: () => {
        toast.error(t('errors.failedToMarkRead'));
      },
    }),
  );

  const handleItemClick = (notification: NotificationData) => {
    if (!notification.readAt) {
      markReadMutation.mutate({ notificationId: notification.id });
    }
    const url = getEntityUrl(notification.entityType, notification.entityId);
    router.push(url);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      void queryClient.invalidateQueries({
        queryKey: [['notification', 'list']],
      });
    }
  };

  // Badge display: cap at 99+
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
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
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">{t('title')}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-xs text-primary hover:underline disabled:opacity-50">
              {t('markAllRead')}
            </button>
          )}
        </div>

        {/* Body */}
        {listQuery.isLoading ? (
          <PopoverSkeletons />
        ) : notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-10">
            <BellOff className="h-8 w-8 text-muted-foreground" />
            <span className="mt-2 text-sm text-muted-foreground">{t('empty')}</span>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[360px]">
              <div className="flex flex-col">
                {notifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onClick={() => handleItemClick(n)}
                    compact
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t px-4 py-2 text-center">
              <button
                type="button"
                onClick={() => router.push('/notifications')}
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
