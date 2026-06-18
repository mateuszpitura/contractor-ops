import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { cursorPaginationTotalRows } from '../../shared/cursor-pagination.js';
import type { TimesheetRow } from '../approval-queue/data-table.js';

/** Query-param value for “no status filter” (all entries). */
export const TIME_STATUS_FILTER_ALL = 'ALL';

export function useTimeTracking() {
  const t = useTranslations('Time');
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('pending'));
  const [statusRaw, setStatusFilter] = useQueryState(
    'status',
    parseAsString.withDefault(TIME_STATUS_FILTER_ALL),
  );
  const statusFilter = statusRaw === 'all' ? TIME_STATUS_FILTER_ALL : statusRaw;

  const [allPageSize, setAllPageSize] = useState(20);
  const [allCursors, setAllCursors] = useState<string[]>([]);
  const allCursor = allCursors[allCursors.length - 1];

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset pagination when filter/page-size changes
  useEffect(() => {
    setAllCursors([]);
  }, [statusFilter, allPageSize]);

  const pendingQuery = useQuery({
    ...trpc.time.listPending.queryOptions(),
    refetchInterval: 30000,
  });

  const listAllInput = useMemo(() => {
    const base = { limit: allPageSize, cursor: allCursor };
    return statusFilter === TIME_STATUS_FILTER_ALL
      ? base
      : {
          ...base,
          status: statusFilter as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
        };
  }, [statusFilter, allPageSize, allCursor]);

  const allQuery = useQuery({
    ...trpc.time.listAll.queryOptions(listAllInput),
    enabled: tab === 'all',
    refetchInterval: 30000,
  });

  const pendingTimesheets = useMemo(
    () => (pendingQuery.data ?? []) as TimesheetRow[],
    [pendingQuery.data],
  );

  const allTimesheets = useMemo(
    () => (allQuery.data?.items ?? []) as TimesheetRow[],
    [allQuery.data],
  );

  const allNextCursor = allQuery.data?.nextCursor;
  const allHasNextPage = Boolean(allNextCursor);
  const allCurrentPage = allCursors.length + 1;
  const allTotalCount = useMemo(
    () =>
      cursorPaginationTotalRows(
        allCursors.length,
        allPageSize,
        allTimesheets.length,
        allHasNextPage,
      ),
    [allCursors.length, allPageSize, allTimesheets.length, allHasNextPage],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [['time', 'listPending']] });
    void queryClient.invalidateQueries({ queryKey: [['time', 'listAll']] });
    void queryClient.invalidateQueries({ queryKey: [['time', 'pendingReviewCount']] });
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
      void router.push(`/time/${contractorId}?week=${weekStartDate}`);
    },
    [router],
  );

  const handleAllPageChange = useCallback(
    (page: number) => {
      if (page < allCurrentPage) {
        setAllCursors(prev => prev.slice(0, page - 1));
        return;
      }
      if (page > allCurrentPage && allNextCursor) {
        setAllCursors(prev => [...prev, allNextCursor]);
      }
    },
    [allCurrentPage, allNextCursor],
  );

  const handleAllPageSizeChange = useCallback((size: number) => {
    setAllPageSize(size);
  }, []);

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
    allPageSize,
    allCurrentPage,
    allTotalCount,
    handleAllPageChange,
    handleAllPageSizeChange,
    isAllFetching: allQuery.isFetching,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isBulkApproving: bulkApproveMutation.isPending,
    isBulkRejecting: bulkRejectMutation.isPending,
  } as const;
}
