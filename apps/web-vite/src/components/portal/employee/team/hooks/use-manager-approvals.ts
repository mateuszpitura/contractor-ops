import type { PortalAppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../../../providers/trpc-provider.js';
import { isModuleDarkError } from '../../hooks/use-employee-dashboard.js';

type PortalRouterOutputs = inferRouterOutputs<PortalAppRouter>;

export type ReportLeaveRequest =
  PortalRouterOutputs['portalManager']['listReportLeaveRequests'][number];

export interface ReportLeaveRow extends ReportLeaveRequest {
  reportName: string | null;
}

export function useManagerApprovals() {
  const t = useTranslations('Portal.employee.team.approvals');
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<ReportLeaveRow | null>(null);

  const requestsQuery = useQuery(
    trpc.portalManager.listReportLeaveRequests.queryOptions(undefined, { retry: false }),
  );
  // The team overview supplies report display names for the request rows.
  const overviewQuery = useQuery(
    trpc.portalManager.getTeamOverview.queryOptions(undefined, { retry: false }),
  );

  const isForbidden =
    (requestsQuery.isError && isModuleDarkError(requestsQuery.error)) ||
    (overviewQuery.isError && isModuleDarkError(overviewQuery.error));

  const nameByWorkerId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const report of overviewQuery.data?.reports ?? []) {
      map.set(report.workerId, report.displayName);
    }
    return map;
  }, [overviewQuery.data]);

  const rows = useMemo<ReportLeaveRow[]>(
    () =>
      (requestsQuery.data ?? []).map(request => ({
        ...request,
        reportName: nameByWorkerId.get(request.workerId) ?? null,
      })),
    [requestsQuery.data, nameByWorkerId],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.portalManager.listReportLeaveRequests.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.portalManager.getTeamOverview.queryKey(),
    });
  }, [queryClient, trpc.portalManager]);

  const approveMutation = useMutation(
    trpc.portalManager.approveReportLeaveRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvedToast'));
        invalidate();
      },
      onError: () => toast.error(t('actionError')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.portalManager.rejectReportLeaveRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('rejectedToast'));
        setRejectTarget(null);
        invalidate();
      },
      onError: () => toast.error(t('actionError')),
    }),
  );

  const approve = useCallback(
    (row: ReportLeaveRow) => {
      approveMutation.mutate({ requestId: row.id, reportWorkerId: row.workerId });
    },
    [approveMutation],
  );

  const confirmReject = useCallback(
    (reason: string) => {
      if (!rejectTarget) return;
      rejectMutation.mutate({
        requestId: rejectTarget.id,
        reportWorkerId: rejectTarget.workerId,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
    },
    [rejectMutation, rejectTarget],
  );

  return {
    isLoading: requestsQuery.isPending,
    isError:
      (requestsQuery.isError && !isModuleDarkError(requestsQuery.error)) ||
      (overviewQuery.isError && !isModuleDarkError(overviewQuery.error)),
    isForbidden,
    isEmpty: !(requestsQuery.isPending || requestsQuery.isError) && rows.length === 0,
    rows,
    approve,
    isApproving: approveMutation.isPending,
    rejectTarget,
    setRejectTarget,
    confirmReject,
    isRejecting: rejectMutation.isPending,
    actingId: approveMutation.isPending ? approveMutation.variables?.requestId : undefined,
  } as const;
}
