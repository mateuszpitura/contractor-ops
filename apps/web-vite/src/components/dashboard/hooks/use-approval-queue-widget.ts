/**
 * Data hook for the dashboard approval-queue widget.
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
