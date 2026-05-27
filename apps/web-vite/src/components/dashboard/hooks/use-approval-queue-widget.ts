/**
 * Data hook for the dashboard approval-queue widget.
 *
 * Ported from `apps/web/src/components/dashboard/approval-queue-widget.tsx`
 * (removed in commit 62a97d73). Split out of the widget UI per
 * `apps/web-vite/ARCHITECTURE.md` so the tRPC/React-Query layer stays
 * inside `components/{domain}/hooks/`.
 */

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useApprovalQueueWidget() {
  const trpc = useTRPC();
  const query = useQuery(trpc.approval.listPending.queryOptions({ page: 1, pageSize: 5 }));

  return {
    isLoading: query.isPending,
    items: query.data?.items ?? [],
  } as const;
}
