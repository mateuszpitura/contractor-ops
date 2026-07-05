import type { PortalAppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { usePortalTRPC } from '../../../../providers/trpc-provider.js';

type PortalRouterOutputs = inferRouterOutputs<PortalAppRouter>;

export type EmployeeDashboardData = PortalRouterOutputs['portalEmployee']['getDashboard'];
export type EmployeePayStubAvailability =
  PortalRouterOutputs['portalEmployee']['getPayStubAvailability'];

/**
 * A dark employee-portal surface answers with FORBIDDEN (flag off for the org),
 * METHOD_NOT_FOUND (namespace unregistered at boot), or UNAUTHORIZED (a
 * non-employee subject). Any of these means "not available to you" — the UI
 * renders a real unavailable state rather than an error boundary.
 */
export function isModuleDarkError(error: unknown): boolean {
  const code = (error as { data?: { code?: string } } | null | undefined)?.data?.code;
  return code === 'FORBIDDEN' || code === 'METHOD_NOT_FOUND' || code === 'UNAUTHORIZED';
}

export function useEmployeeDashboard() {
  const trpc = usePortalTRPC();

  const dashboardQuery = useQuery(
    trpc.portalEmployee.getDashboard.queryOptions(undefined, { retry: false }),
  );
  const payStubQuery = useQuery(
    trpc.portalEmployee.getPayStubAvailability.queryOptions(undefined, { retry: false }),
  );

  const isUnavailable = dashboardQuery.isError && isModuleDarkError(dashboardQuery.error);
  const dashboard = dashboardQuery.data ?? null;
  const isEmpty =
    !dashboard ||
    (dashboard.balances.length === 0 &&
      dashboard.pendingLeaveCount === 0 &&
      dashboard.recentTime.length === 0 &&
      dashboard.nextLeave === null);

  const payStubUnavailable = payStubQuery.isError && isModuleDarkError(payStubQuery.error);

  return {
    isLoading: dashboardQuery.isPending,
    isError: dashboardQuery.isError && !isUnavailable,
    isUnavailable,
    isEmpty: !(dashboardQuery.isPending || dashboardQuery.isError) && isEmpty,
    dashboard,
    balances: dashboard?.balances ?? [],
    pendingLeaveCount: dashboard?.pendingLeaveCount ?? 0,
    nextLeave: dashboard?.nextLeave ?? null,
    recentTime: dashboard?.recentTime ?? [],
    payStub: {
      isLoading: payStubQuery.isPending,
      isUnavailable: payStubUnavailable,
      // The truthful availability model — `available:false` in v7.0. A future
      // payslip surface flips this true.
      data: payStubQuery.data ?? null,
    },
  } as const;
}
