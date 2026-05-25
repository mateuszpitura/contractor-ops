import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { NotificationData } from '../notification-item.js';
import { getEntityUrl } from '../notification-item.js';

type NotificationType =
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_DECISION'
  | 'TASK_ASSIGNED'
  | 'TASK_OVERDUE'
  | 'CONTRACT_EXPIRING'
  | 'INVOICE_RECEIVED';

const TYPE_MAP: Record<string, NotificationType[]> = {
  approvals: ['APPROVAL_REQUEST', 'APPROVAL_DECISION'],
  tasks: ['TASK_ASSIGNED', 'TASK_OVERDUE'],
  contracts: ['CONTRACT_EXPIRING'],
  invoices: ['INVOICE_RECEIVED'],
};

export const NOTIFICATION_FILTER_KEYS = [
  'all',
  'approvals',
  'tasks',
  'contracts',
  'invoices',
] as const;

export function useNotificationCenter() {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const [typeFilter, setTypeFilter] = useQueryState('type', parseAsString.withDefault('all'));
  const [unreadOnly, setUnreadOnly] = useQueryState('unread', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  const queryInput = useMemo(() => {
    const types = typeFilter === 'all' ? undefined : TYPE_MAP[typeFilter];
    const type: NotificationType | undefined = types && types.length === 1 ? types[0] : undefined;

    return {
      type,
      unreadOnly: unreadOnly === 'true' ? true : undefined,
      page,
      pageSize: 10,
    };
  }, [typeFilter, unreadOnly, page]);

  const listQuery = useQuery({
    ...trpc.notification.list.queryOptions(queryInput),
  });

  const data = useMemo(() => {
    const result = listQuery.data as
      | { items: NotificationData[]; total: number; page: number; totalPages: number }
      | undefined;
    return result;
  }, [listQuery.data]);

  const notifications = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const unreadQuery = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
  });
  const unreadCount = (unreadQuery.data as { count: number } | undefined)?.count ?? 0;

  const markReadMutation = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['notification']],
        });
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const markAllReadMutation = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => {
        toast.success(t('markedAllRead'));
        void queryClient.invalidateQueries({
          queryKey: [['notification']],
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

  const handleFilterChange = useCallback(
    (filter: string) => {
      void setTypeFilter(filter);
      void setPage(1);
    },
    [setTypeFilter, setPage],
  );

  const handleUnreadToggle = useCallback(
    (checked: boolean) => {
      void setUnreadOnly(checked ? 'true' : '');
      void setPage(1);
    },
    [setUnreadOnly, setPage],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate(undefined as never);
  }, [markAllReadMutation]);

  const handlePreviousPage = useCallback(() => {
    void setPage(page - 1);
  }, [setPage, page]);

  const handleNextPage = useCallback(() => {
    void setPage(page + 1);
  }, [setPage, page]);

  const isLoading = listQuery.isLoading;
  const isEmpty = !isLoading && notifications.length === 0;

  return {
    typeFilter,
    unreadOnly,
    page,
    notifications,
    totalPages,
    unreadCount,
    isLoading,
    isEmpty,
    isMarkingRead: markReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
    handleItemClick,
    handleFilterChange,
    handleUnreadToggle,
    handleMarkAllRead,
    handlePreviousPage,
    handleNextPage,
  } as const;
}
