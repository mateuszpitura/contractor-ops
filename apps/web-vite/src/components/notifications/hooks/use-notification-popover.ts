import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { NotificationData } from '../notification-item.js';
import { getEntityUrl } from '../notification-item.js';

export function useNotificationPopover() {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const unreadQuery = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const unreadCount = (unreadQuery.data as { count: number } | undefined)?.count ?? 0;

  const listQuery = useQuery({
    ...trpc.notification.list.queryOptions({ pageSize: 10 }),
    enabled: true,
  });

  const notifications = (listQuery.data as { items: NotificationData[] } | undefined)?.items ?? [];

  const markReadMutation = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['notification', 'unreadCount']],
        });
        void queryClient.invalidateQueries({
          queryKey: [['notification', 'list']],
        });
        toast.success(t('markedRead'));
      },
      onError: err => toast.error(err.message),
    }),
  );

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

  const handleItemClick = useCallback(
    (notification: NotificationData) => {
      if (!notification.readAt) {
        markReadMutation.mutate({ notificationId: notification.id });
      }
      const url = getEntityUrl(notification.entityType, notification.entityId);
      router.push(url);
    },
    [markReadMutation, router],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        void queryClient.invalidateQueries({
          queryKey: [['notification', 'list']],
        });
      }
    },
    [queryClient],
  );

  const handleViewAll = useCallback(() => {
    router.push('/notifications');
  }, [router]);

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate(undefined as never);
  }, [markAllReadMutation]);

  return {
    unreadCount,
    notifications,
    isLoading: listQuery.isLoading,
    isMarkingRead: markReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
    handleItemClick,
    handleOpenChange,
    handleViewAll,
    handleMarkAllRead,
  } as const;
}
