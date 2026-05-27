/**
 * Data hook for the dashboard deadlines widget — contract expirations,
 * overdue tasks, and due invoices sorted by urgency. Ported alongside
 * `deadlines-widget.tsx` from the legacy apps/web tree (commit 62a97d73).
 */

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDeadlinesWidget() {
  const trpc = useTRPC();
  const query = useQuery(trpc.dashboard.deadlines.queryOptions());

  return {
    isLoading: query.isPending,
    items: query.data ?? [],
  } as const;
}
