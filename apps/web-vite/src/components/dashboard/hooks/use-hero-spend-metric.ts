/**
 * Data hook for `hero-spend-metric` — reuses `dashboard.spendTrend`
 * with a fixed 6-month window and collapses the multi-currency rows
 * into per-month totals (sum across currencies). Ported alongside
 * `hero-spend-metric.tsx` from legacy apps/web (commit 62a97d73).
 */

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useHeroSpendMetric() {
  const trpc = useTRPC();
  const query = useQuery(trpc.dashboard.spendTrend.queryOptions({ months: '6' }));

  return {
    isLoading: query.isPending,
    isError: query.isError,
    onRetry: () => query.refetch(),
    rows: query.data ?? [],
  } as const;
}
