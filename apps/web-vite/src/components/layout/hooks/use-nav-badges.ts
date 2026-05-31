import { useQuery } from '@tanstack/react-query';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const REFETCH_MS = 60_000;

export type NavBadgeKey = 'workflows' | 'approvals' | 'time' | 'notifications';

export type NavBadgeCounts = Record<NavBadgeKey, number>;

export function useNavBadges(): NavBadgeCounts {
  const trpc = useTRPC();
  const { can } = usePermissions();

  const workflows = useQuery({
    ...trpc.workflow.overdueCount.queryOptions(),
    enabled: can('workflow', ['read']),
    refetchInterval: REFETCH_MS,
  });

  const approvals = useQuery({
    ...trpc.approval.actionableCount.queryOptions(),
    enabled: can('invoice', ['approve']),
    refetchInterval: REFETCH_MS,
  });

  const time = useQuery({
    ...trpc.time.pendingReviewCount.queryOptions(),
    enabled: can('time', ['read']),
    refetchInterval: REFETCH_MS,
  });

  const notifications = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
    refetchInterval: REFETCH_MS,
  });

  return {
    workflows: (workflows.data as { count: number } | undefined)?.count ?? 0,
    approvals: (approvals.data as { count: number } | undefined)?.count ?? 0,
    time: (time.data as { count: number } | undefined)?.count ?? 0,
    notifications: (notifications.data as { count: number } | undefined)?.count ?? 0,
  };
}
