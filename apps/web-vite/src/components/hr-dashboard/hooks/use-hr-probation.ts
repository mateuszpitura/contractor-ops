import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Probation-watchlist read model bucketed 14 / 7 / 0-day (HR-DASH-04). */
export type HrProbation = RouterOutputs['hrDashboard']['getProbationWatchlist'];
export type ProbationItem = HrProbation['dueToday'][number];

/**
 * Sole tRPC boundary for the HR-DASH-04 probation-watchlist section. Reads the
 * 0 / <=7 / <=14-day buckets of workers whose probation ends soon. Returns a
 * props bag + variant flags; the wired section owns loading / empty (nothing due)
 * / error.
 */
export function useHrProbation() {
  const trpc = useTRPC();
  const query = useQuery(trpc.hrDashboard.getProbationWatchlist.queryOptions({}));

  const data = query.data;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    isEmpty: data !== undefined && data.total === 0,
    onRetry: () => void query.refetch(),
    dueToday: data?.dueToday ?? [],
    dueWithin7: data?.dueWithin7 ?? [],
    dueWithin14: data?.dueWithin14 ?? [],
    total: data?.total ?? 0,
  } as const;
}
