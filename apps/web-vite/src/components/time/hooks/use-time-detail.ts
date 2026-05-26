import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useTimeDetail(contractorId: string, week: string | null) {
  const t = useTranslations('Time');
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    ...trpc.time.listAll.queryOptions({
      contractorId,
      ...(week ? { from: week, to: week } : {}),
      limit: 1,
    }),
    enabled: Boolean(contractorId),
  });

  const timesheetId = useMemo(() => {
    const data = listQuery.data as { items: Array<{ id: string }> } | undefined;
    return data?.items?.[0]?.id;
  }, [listQuery.data]);

  const detailQuery = useQuery({
    ...trpc.time.getTimesheet.queryOptions({
      timesheetId: timesheetId ?? '',
    }),
    enabled: !!timesheetId,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [['time']] });
  }, [queryClient]);

  const approveMutation = useMutation(
    trpc.time.approve.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        invalidate();
        router.push('/time');
      },
      onError: () => toast.error(t('errors.failedToApprove')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.time.reject.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        invalidate();
        router.push('/time');
      },
      onError: () => toast.error(t('errors.failedToReject')),
    }),
  );

  const handleApprove = useCallback(() => {
    if (!timesheetId) return;
    approveMutation.mutate({ timesheetId });
  }, [timesheetId, approveMutation]);

  const handleReject = useCallback(
    (reason: string) => {
      if (!timesheetId) return;
      rejectMutation.mutate({ timesheetId, reason });
    },
    [timesheetId, rejectMutation],
  );

  const handleBack = useCallback(() => {
    router.push('/time');
  }, [router]);

  return {
    listQuery,
    detailQuery,
    timesheetId,
    timesheet: detailQuery.data,
    handleApprove,
    handleReject,
    handleBack,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  } as const;
}
