import type { PortalAppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../../providers/trpc-provider.js';
import { isModuleDarkError } from './use-employee-dashboard.js';

type PortalRouterOutputs = inferRouterOutputs<PortalAppRouter>;

export type EmployeeLeaveRequest =
  PortalRouterOutputs['portalEmployee']['listMyLeaveRequests'][number];

export interface TimeOffFormValues {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  requestedMinutes: number;
  note?: string;
}

export interface LeaveTypeOption {
  leaveTypeId: string;
  availableMinutes: number;
}

export function useEmployeeLeave() {
  const t = useTranslations('Portal.employee.leave');
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const balanceQuery = useQuery(
    trpc.portalEmployee.getDashboard.queryOptions(undefined, { retry: false }),
  );
  const requestsQuery = useQuery(
    trpc.portalEmployee.listMyLeaveRequests.queryOptions(undefined, { retry: false }),
  );

  const isUnavailable =
    (balanceQuery.isError && isModuleDarkError(balanceQuery.error)) ||
    (requestsQuery.isError && isModuleDarkError(requestsQuery.error));

  const balances = balanceQuery.data?.balances ?? [];
  const requests: EmployeeLeaveRequest[] = requestsQuery.data ?? [];

  const leaveTypeOptions = useMemo<LeaveTypeOption[]>(
    () =>
      balances.map(balance => ({
        leaveTypeId: balance.leaveTypeId,
        availableMinutes: balance.entitledMinutes + balance.carryoverMinutes - balance.usedMinutes,
      })),
    [balances],
  );

  const submitMutation = useMutation(
    trpc.portalEmployee.submitTimeOffRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('form.successToast'));
        setDialogOpen(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.portalEmployee.listMyLeaveRequests.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.portalEmployee.getDashboard.queryKey(),
        });
      },
      onError: error => {
        toast.error(isModuleDarkError(error) ? t('unavailable') : t('form.errorToast'));
      },
    }),
  );

  const submit = useCallback(
    (values: TimeOffFormValues) => {
      submitMutation.mutate({
        leaveTypeId: values.leaveTypeId,
        startDate: values.startDate,
        endDate: values.endDate,
        requestedMinutes: values.requestedMinutes,
        ...(values.note ? { note: values.note } : {}),
      });
    },
    [submitMutation],
  );

  const isLoading = balanceQuery.isPending || requestsQuery.isPending;

  return {
    isLoading,
    isError:
      (balanceQuery.isError && !isModuleDarkError(balanceQuery.error)) ||
      (requestsQuery.isError && !isModuleDarkError(requestsQuery.error)),
    isUnavailable,
    isEmpty: !isLoading && requests.length === 0 && balances.length === 0,
    balances,
    requests,
    leaveTypeOptions,
    dialogOpen,
    setDialogOpen,
    submit,
    isSubmitting: submitMutation.isPending,
    canRequest: leaveTypeOptions.length > 0,
  } as const;
}
