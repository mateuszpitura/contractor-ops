/**
 * Data hook for the bento KPI cards — uses the dedicated
 * `dashboard.kpis` procedure (returns previous-period values for trend
 * arrows, unlike the slimmed-down KPI block that ships with
 * `dashboard.bootstrap`). Ported alongside `kpi-cards.tsx` from legacy
 * apps/web (commit 62a97d73).
 */

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useKpiCards() {
  const trpc = useTRPC();
  const query = useQuery(trpc.dashboard.kpis.queryOptions());

  return {
    isLoading: query.isPending,
    data: query.data,
  } as const;
}
