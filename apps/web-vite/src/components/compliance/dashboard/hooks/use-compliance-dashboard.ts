import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../../providers/trpc-provider.js';

/** D-04 — blocked-payments tab refreshes every 60s (paused on backgrounded tab by default). */
const BLOCKED_PAYMENTS_POLL_MS = 60_000;

export type ComplianceDashboardTab = 'at-risk' | 'upcoming-renewals' | 'blocked-payments';

/**
 * Phase 73 COMPL-01 — the ONLY tRPC boundary for the admin compliance dashboard.
 * Fetches the KPI counts + the three list endpoints (Plan 73-05) in parallel and
 * returns a flags-and-props bag. The container decides loading/empty/error; this
 * hook never branches on them.
 */
export function useComplianceDashboard() {
  const trpc = useTRPC();

  const kpisQuery = useQuery(trpc.classification.dashboardKpis.queryOptions());
  const atRiskQuery = useQuery(trpc.classification.dashboardAtRisk.queryOptions());
  const upcomingQuery = useQuery(trpc.classification.dashboardUpcomingRenewals.queryOptions());
  const blockedQuery = useQuery(
    trpc.classification.dashboardBlockedPayments.queryOptions(undefined, {
      refetchInterval: BLOCKED_PAYMENTS_POLL_MS,
    }),
  );

  const isPending =
    kpisQuery.isPending ||
    atRiskQuery.isPending ||
    upcomingQuery.isPending ||
    blockedQuery.isPending;

  const error =
    kpisQuery.error ?? atRiskQuery.error ?? upcomingQuery.error ?? blockedQuery.error ?? null;

  const kpis = kpisQuery.data;
  const atRiskRows = atRiskQuery.data ?? [];
  const upcomingRows = upcomingQuery.data ?? [];
  const blockedRows = blockedQuery.data ?? [];

  const isEmpty =
    !(isPending || error) &&
    (kpis?.atRisk.value ?? 0) === 0 &&
    (kpis?.upcomingRenewals.value ?? 0) === 0 &&
    (kpis?.blockedPayments.value ?? 0) === 0 &&
    atRiskRows.length === 0 &&
    upcomingRows.length === 0 &&
    blockedRows.length === 0;

  return {
    isPending,
    error,
    isEmpty,
    kpis,
    atRiskProps: { rows: atRiskRows, totalRows: atRiskRows.length },
    upcomingProps: { rows: upcomingRows, totalRows: upcomingRows.length },
    blockedProps: {
      rows: blockedRows,
      totalRows: blockedRows.length,
      isRefetching: blockedQuery.isRefetching,
    },
  } as const;
}

export type AtRiskRow = NonNullable<
  ReturnType<typeof useComplianceDashboard>['atRiskProps']
>['rows'][number];
export type UpcomingRow = NonNullable<
  ReturnType<typeof useComplianceDashboard>['upcomingProps']
>['rows'][number];
export type BlockedRow = NonNullable<
  ReturnType<typeof useComplianceDashboard>['blockedProps']
>['rows'][number];
