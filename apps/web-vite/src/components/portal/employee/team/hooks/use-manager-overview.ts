import type { PortalAppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { usePortalTRPC } from '../../../../../providers/trpc-provider.js';
import { isModuleDarkError } from '../../hooks/use-employee-dashboard.js';

type PortalRouterOutputs = inferRouterOutputs<PortalAppRouter>;

export type ManagerTeamReport =
  PortalRouterOutputs['portalManager']['getTeamOverview']['reports'][number];

export function useManagerOverview() {
  const trpc = usePortalTRPC();

  const overviewQuery = useQuery(
    trpc.portalManager.getTeamOverview.queryOptions(undefined, { retry: false }),
  );

  // portalManagerProcedure throws FORBIDDEN for a caller with no reports (and
  // FORBIDDEN/METHOD_NOT_FOUND when the module is dark) — either way the caller
  // is not a manager here, so the surface renders a forbidden state, not a crash.
  const isForbidden = overviewQuery.isError && isModuleDarkError(overviewQuery.error);
  const reports: ManagerTeamReport[] = overviewQuery.data?.reports ?? [];

  return {
    isLoading: overviewQuery.isPending,
    isError: overviewQuery.isError && !isForbidden,
    isForbidden,
    isEmpty: !(overviewQuery.isPending || overviewQuery.isError) && reports.length === 0,
    isManager: !(overviewQuery.isPending || overviewQuery.isError),
    reports,
  } as const;
}
