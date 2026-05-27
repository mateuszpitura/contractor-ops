/**
 * Data hook for the dashboard activity feed — last ~20 audit-log events.
 * Ported alongside `activity-feed.tsx` from legacy apps/web (commit 62a97d73).
 */

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useActivityFeed() {
  const trpc = useTRPC();
  const query = useQuery(trpc.dashboard.activity.queryOptions());

  return {
    isLoading: query.isPending,
    items: query.data?.items ?? [],
  } as const;
}
