import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** The dashboard read-model (hero rate, neutral band, Qiwa gap, Iqama roll-up, side-by-side headcount). */
export type SaudizationDashboardData = RouterOutputs['gulf']['saudization']['dashboard'];

/**
 * The read-only tRPC boundary for the Saudization dashboard. Reads the derived
 * dashboard read-model — the band is surfaced verbatim from the manual config
 * and the rate is computed only from the manual headcount. This is the sole
 * React-Query boundary for the dashboard section; the container and view stay
 * presentational.
 */
export function useSaudizationDashboard() {
  const trpc = useTRPC();
  const query = useQuery(trpc.gulf.saudization.dashboard.queryOptions());

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    onRetry: () => void query.refetch(),
    data: query.data ?? null,
  } as const;
}
