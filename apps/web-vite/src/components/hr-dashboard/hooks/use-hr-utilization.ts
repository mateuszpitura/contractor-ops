import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Per worker-year vacation-utilization read model (HR-DASH-02). */
export type HrUtilization = RouterOutputs['hrDashboard']['getVacationUtilization'];
export type WorkerUtilizationRow = HrUtilization['items'][number];

/**
 * Sole tRPC boundary for the HR-DASH-02 vacation-utilization section. Reads the
 * per worker-year taken / entitled / unused days (already derived to days by the
 * server) plus the under-utilized count. Returns a props bag + variant flags;
 * the wired section owns loading / degraded (no leave balances) / error. When
 * `items` is empty the leave source is dark — the section renders a degraded
 * card rather than a table.
 */
export function useHrUtilization() {
  const trpc = useTRPC();
  const query = useQuery(trpc.hrDashboard.getVacationUtilization.queryOptions({}));

  const data = query.data;
  const items = data?.items ?? [];

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    isEmpty: data !== undefined && items.length === 0,
    onRetry: () => void query.refetch(),
    items,
    underUtilizedItems: items.filter(item => item.underUtilized),
    underUtilizedCount: data?.underUtilizedCount ?? 0,
  } as const;
}
