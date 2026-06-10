import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createParser, parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useLocale } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ApprovalQueueRow } from '../approval-queue/columns.js';
import { getColumns } from '../approval-queue/columns.js';
import { useApprovalChain } from './use-approval-chain.js';
import { useApprovalQueueBulkActions } from './use-approval-queue-bulk-actions.js';

// Uppercase the URL ?status= values on read so the chip toggles, the
// `matchesStatusFilter` comparison, and the tRPC `apiStatus` payload all
// speak the same canonical enum. Keeps external links like the
// dashboard's "Pending approvals" KPI (`?status=PENDING`) and existing
// lowercase URLs both working — the parser folds both to uppercase.
const parseAsUpperEnumArray = createParser<string[]>({
  parse(query) {
    if (!query) return [];
    return query
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => v.toUpperCase());
  },
  serialize(value) {
    return value.join(',');
  },
}).withDefault([]);

function matchesStatusFilter(row: ApprovalQueueRow, filterSet: Set<string>): boolean {
  const isOverdue =
    row.status === 'PENDING' && !!row.slaDeadline && new Date(row.slaDeadline) < new Date();
  if (filterSet.has('OVERDUE') && isOverdue) return true;
  if (filterSet.has('PENDING') && row.status === 'PENDING') return true;
  if (filterSet.has('APPROVED') && row.status === 'APPROVED') return true;
  if (filterSet.has('REJECTED') && row.status === 'REJECTED') return true;
  return false;
}

export type ChangeRequestRow = {
  id: string;
  contractorName: string;
  contractorEmail: string;
  requestedChanges: Record<string, unknown>;
  previousValues: Record<string, unknown>;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export function useApprovalQueue() {
  const t = useTranslations('Approvals');
  const locale = useLocale();
  const trpc = useTRPC();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('my'));
  const [statuses, setStatuses] = useQueryState('status', parseAsUpperEnumArray);
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState('pageSize', parseAsInteger.withDefault(10));

  const [selectedStep, setSelectedStep] = useState<ApprovalQueueRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isAdmin = can('settings', ['read']);

  const changeRequestsQuery = useQuery({
    ...trpc.settings.listChangeRequests.queryOptions({ status: 'PENDING' }),
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const changeRequests = (changeRequestsQuery.data ?? []) as unknown as ChangeRequestRow[];
  const pendingCount = changeRequests.length;

  const apiStatus: 'ALL' | 'PENDING' | 'OVERDUE' | 'APPROVED' | 'REJECTED' =
    statuses.length === 1
      ? (statuses[0] as 'PENDING' | 'OVERDUE' | 'APPROVED' | 'REJECTED')
      : 'ALL';

  const queryInput = useMemo(
    () => ({
      tab: tab as 'my' | 'all',
      status: apiStatus,
      search: search || undefined,
      page,
      pageSize,
      sortBy: 'slaDeadline' as const,
      sortOrder: 'asc' as const,
    }),
    [tab, apiStatus, search, page, pageSize],
  );

  const queueQuery = useQuery({
    ...trpc.approval.listPending.queryOptions(queryInput),
    refetchInterval: 30000,
  });

  const data = useMemo(() => {
    const result = queueQuery.data as
      | { items: ApprovalQueueRow[]; total: number; page: number; pageSize: number }
      | undefined;
    const items = result?.items ?? [];
    if (statuses.length <= 1) return items;
    const filterSet = new Set(statuses);
    return items.filter(row => matchesStatusFilter(row, filterSet));
  }, [queueQuery.data, statuses]);

  const totalRows = useMemo(() => {
    const result = queueQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [queueQuery.data]);

  const pageCount = Math.ceil(totalRows / pageSize);

  const approvalInvalidate = [
    [['approval', 'listPending']] as const,
    [['approval', 'actionableCount']] as const,
  ];

  const approveMutation = useResourceMutation(trpc.approval.approve.mutationOptions(), {
    invalidate: approvalInvalidate,
    successMessage: t('toast.approved'),
    errorMessage: t('errors.failedToApprove'),
  });

  const rejectMutation = useResourceMutation(trpc.approval.reject.mutationOptions(), {
    invalidate: approvalInvalidate,
    successMessage: t('toast.rejected'),
    errorMessage: t('errors.failedToReject'),
  });

  const columns = useMemo(
    () =>
      getColumns(
        t,
        {
          onApprove: stepId => approveMutation.mutate({ stepId }),
          onReject: (stepId, comment) => rejectMutation.mutate({ stepId, comment }),
          isApproving: approveMutation.isPending,
          isRejecting: rejectMutation.isPending,
        },
        locale,
      ),
    [t, approveMutation, rejectMutation, locale],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const bulkActions = useApprovalQueueBulkActions(handleClearSelection);

  const handleRowClick = useCallback((row: ApprovalQueueRow) => {
    setSelectedStep(row);
    setSidePanelOpen(true);
  }, []);

  const handlePageChange = useCallback((newPage: number) => void setPage(newPage), [setPage]);

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      void setPageSize(newSize);
      void setPage(1);
    },
    [setPageSize, setPage],
  );

  const handleStatusChange = useCallback(
    (newStatuses: string[]) => {
      void setStatuses(newStatuses);
      void setPage(1);
    },
    [setStatuses, setPage],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      void setSearch(value);
      void setPage(1);
    },
    [setSearch, setPage],
  );

  const handleTabChange = useCallback(
    (value: string) => {
      void setTab(value);
      void setPage(1);
    },
    [setTab, setPage],
  );

  const handleChangeRequestInvalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.settings.listChangeRequests.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: [['approval', 'actionableCount']],
    });
  }, [queryClient, trpc.settings.listChangeRequests]);

  const handleSidePanelOpenChange = useCallback((open: boolean) => {
    setSidePanelOpen(open);
    if (!open) setSelectedStep(null);
  }, []);

  const handleClearFilters = useCallback(() => {
    void setStatuses([]);
    void setSearch('');
  }, [setStatuses, setSearch]);

  useEffect(() => {
    setSelectedIds([]);
  }, []);

  const isLoading = queueQuery.isLoading;
  const isEmpty = !isLoading && data.length === 0;
  const showQueueEmptyState = isEmpty && statuses.length === 0 && !search;

  const chainConfigId = sidePanelOpen ? selectedStep?.approvalFlow.chainConfigId : undefined;
  const resolvedChain = useApprovalChain(chainConfigId, sidePanelOpen);

  return {
    tab,
    isAdmin,
    pendingCount,
    changeRequests,
    changeRequestsLoading: changeRequestsQuery.isLoading,
    onTabChange: handleTabChange,
    onChangeRequestInvalidate: handleChangeRequestInvalidate,
    showQueueEmptyState,
    queueSectionProps: {
      statuses,
      search,
      selectedIds,
      data,
      columns,
      pageCount,
      page,
      pageSize,
      totalRows,
      isLoading,
      isSearching: queueQuery.isFetching && !isLoading,
      onStatusChange: handleStatusChange,
      onSearchChange: handleSearchChange,
      onClearSelection: handleClearSelection,
      onClearFilters: handleClearFilters,
      onPageChange: handlePageChange,
      onPageSizeChange: handlePageSizeChange,
      onRowClick: handleRowClick,
      onSelectionChange: setSelectedIds,
      bulkActions,
    },
    sidePanelProps: {
      step: sidePanelOpen ? selectedStep : null,
      open: sidePanelOpen,
      onOpenChange: handleSidePanelOpenChange,
      resolvedChain: {
        chain: resolvedChain.chain,
        steps: resolvedChain.steps,
        isLoading: resolvedChain.isLoading,
      },
    },
  } as const;
}
