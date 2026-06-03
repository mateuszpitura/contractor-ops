import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** The Plan 05 dashboard read-model (hero rate, neutral band, Qiwa gap, Iqama roll-up, side-by-side headcount). */
export type SaudizationDashboardData = RouterOutputs['gulf']['saudization']['dashboard'];

/**
 * The read-only tRPC boundary for the Saudization dashboard (GULF-06). Reads the
 * derived dashboard read-model (Plan 04 derivation, Plan 05 router) — the band is
 * surfaced verbatim from the manual config and the rate is computed only from the
 * manual headcount (D-10 / Pitfall 8). This is the sole React-Query boundary for the
 * dashboard section; the container and view stay presentational.
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
