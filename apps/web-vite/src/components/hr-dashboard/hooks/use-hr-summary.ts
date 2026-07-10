import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** The composite KPI headline counts for the HR dashboard header. */
export type HrSummary = RouterOutputs['hrDashboard']['getSummary'];

/**
 * Sole tRPC boundary for the HR dashboard KPI header. Reads the composite
 * `getSummary` headline counts (total headcount, under-utilized, probation-due,
 * expiring-docs). Returns a props bag + variant flags; the wired header owns the
 * loading / empty / error branches.
 */
export function useHrSummary() {
  const trpc = useTRPC();
  const query = useQuery(trpc.hrDashboard.getSummary.queryOptions({}));

  const data = query.data;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    isEmpty: data !== undefined && data.totalHeadcount === 0,
    onRetry: () => void query.refetch(),
    kpiProps: {
      totalHeadcount: data?.totalHeadcount ?? 0,
      underUtilizedCount: data?.underUtilizedCount ?? 0,
      probationDueCount: data?.probationDueCount ?? 0,
      expiringDocCount: data?.expiringDocCount ?? 0,
      degradedEntitlementCount: data?.degradedEntitlementCount ?? 0,
    },
  } as const;
}
