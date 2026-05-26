import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { TimesheetRow } from '../approval-queue-table.js';

export function useTimeTracking() {
  const t = useTranslations('Time');
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('pending'));
  const [statusFilter, setStatusFilter] = useQueryState('status', parseAsString.withDefault('all'));

  const pendingQuery = useQuery({
    ...trpc.time.listPending.queryOptions(),
    refetchInterval: 30000,
  });

  const listAllInput = useMemo(
    () =>
      statusFilter === 'all'
        ? { limit: 20 as const }
        : {
            limit: 20 as const,
            status: statusFilter as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
          },
    [statusFilter],
  );

  const allQuery = useInfiniteQuery({
    ...trpc.time.listAll.infiniteQueryOptions(listAllInput, {
      getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    }),
    enabled: tab === 'all',
    refetchInterval: 30000,
  });

  const pendingTimesheets = useMemo(
    () => (pendingQuery.data ?? []) as TimesheetRow[],
    [pendingQuery.data],
  );

  const allTimesheets = useMemo(() => {
    const pages = allQuery.data?.pages ?? [];
    return pages.flatMap(page => (page.items ?? []) as TimesheetRow[]);
  }, [allQuery.data]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [['time', 'listPending']] });
    void queryClient.invalidateQueries({ queryKey: [['time', 'listAll']] });
  }, [queryClient]);

  const approveMutation = useMutation(
    trpc.time.approve.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToApprove')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.time.reject.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToReject')),
    }),
  );

  const bulkApproveMutation = useMutation(
    trpc.time.bulkApprove.mutationOptions({
      onSuccess: data => {
        const result = data as { count: number };
        toast.success(t('toast.bulkApproved', { count: result.count }));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToApproveTimesheets')),
    }),
  );

  const bulkRejectMutation = useMutation(
    trpc.time.bulkReject.mutationOptions({
      onSuccess: data => {
        const result = data as { count: number };
        toast.success(t('toast.bulkRejected', { count: result.count }));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToRejectTimesheets')),
    }),
  );

  const handleApprove = useCallback(
    (timesheetId: string) => approveMutation.mutate({ timesheetId }),
    [approveMutation],
  );

  const handleReject = useCallback(
    (timesheetId: string, reason: string) => rejectMutation.mutate({ timesheetId, reason }),
    [rejectMutation],
  );

  const handleBulkApprove = useCallback(
    (timesheetIds: string[]) => bulkApproveMutation.mutate({ timesheetIds }),
    [bulkApproveMutation],
  );

  const handleBulkReject = useCallback(
    (timesheetIds: string[], reason: string) => bulkRejectMutation.mutate({ timesheetIds, reason }),
    [bulkRejectMutation],
  );

  const handleNavigateToReview = useCallback(
    (contractorId: string, weekStartDate: string) => {
      router.push(`/time/${contractorId}?week=${weekStartDate}`);
    },
    [router],
  );

  const handleLoadMoreAll = useCallback(() => {
    void allQuery.fetchNextPage();
  }, [allQuery]);

  return {
    t,
    tab,
    setTab,
    statusFilter,
    setStatusFilter,
    pendingQuery,
    allQuery,
    pendingTimesheets,
    allTimesheets,
    handleApprove,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
    handleNavigateToReview,
    handleLoadMoreAll,
    hasMoreAll: allQuery.hasNextPage ?? false,
    isFetchingMoreAll: allQuery.isFetchingNextPage,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isBulkApproving: bulkApproveMutation.isPending,
    isBulkRejecting: bulkRejectMutation.isPending,
  } as const;
}
