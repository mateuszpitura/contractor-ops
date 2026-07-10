import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Headcount total + breakdown buckets over the active workforce. */
export type HrHeadcount = RouterOutputs['hrDashboard']['getHeadcount'];
export type HeadcountBucket = HrHeadcount['byDepartment'][number];
export type ContractEndBuckets = HrHeadcount['byContractEndBucket'];

/**
 * Sole tRPC boundary for the headcount section. Reads the active
 * total plus the department / jurisdiction / employment-type / contract-end
 * breakdowns. Returns a props bag + variant flags; the wired section owns the
 * loading / empty (no active employees) / error branches.
 */
export function useHrHeadcount() {
  const trpc = useTRPC();
  const query = useQuery(trpc.hrDashboard.getHeadcount.queryOptions({}));

  const data = query.data;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    isEmpty: data !== undefined && data.total === 0,
    onRetry: () => void query.refetch(),
    total: data?.total ?? 0,
    byDepartment: data?.byDepartment ?? [],
    byJurisdiction: data?.byJurisdiction ?? [],
    byEmploymentType: data?.byEmploymentType ?? [],
    byContractEndBucket: data?.byContractEndBucket ?? {
      expiredOrPast: 0,
      soon30: 0,
      soon90: 0,
      later: 0,
      none: 0,
    },
  } as const;
}
