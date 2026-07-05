import type { PortalAppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { usePortalTRPC } from '../../../../providers/trpc-provider.js';
import { isModuleDarkError } from './use-employee-dashboard.js';

type PortalRouterOutputs = inferRouterOutputs<PortalAppRouter>;

export type EmployeeTimeRecord = PortalRouterOutputs['portalEmployee']['getMyTime'][number];
export type EmployeeEwidencjaSnapshot =
  PortalRouterOutputs['portalEmployee']['getMyEwidencja'][number];

export function useEmployeeTime() {
  const trpc = usePortalTRPC();

  const timeQuery = useQuery(
    trpc.portalEmployee.getMyTime.queryOptions(undefined, { retry: false }),
  );
  const ewidencjaQuery = useQuery(
    trpc.portalEmployee.getMyEwidencja.queryOptions(undefined, { retry: false }),
  );

  const isUnavailable =
    (timeQuery.isError && isModuleDarkError(timeQuery.error)) ||
    (ewidencjaQuery.isError && isModuleDarkError(ewidencjaQuery.error));

  const timeRecords: EmployeeTimeRecord[] = timeQuery.data ?? [];
  const ewidencja: EmployeeEwidencjaSnapshot[] = ewidencjaQuery.data ?? [];
  const isLoading = timeQuery.isPending || ewidencjaQuery.isPending;

  return {
    isLoading,
    isError:
      (timeQuery.isError && !isModuleDarkError(timeQuery.error)) ||
      (ewidencjaQuery.isError && !isModuleDarkError(ewidencjaQuery.error)),
    isUnavailable,
    isEmpty: !isLoading && timeRecords.length === 0 && ewidencja.length === 0,
    timeRecords,
    ewidencja,
  } as const;
}
