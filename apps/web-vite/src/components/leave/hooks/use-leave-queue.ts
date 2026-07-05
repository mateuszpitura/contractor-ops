import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo, useState } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

/** A statutory full-time working day used to render leave minutes as days. */
const MINUTES_PER_WORK_DAY = 8 * 60;

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveQueueRow {
  id: string;
  workerId: string;
  workerName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  requestedMinutes: number;
  status: LeaveStatus;
  teamId: string | null;
}

export function minutesToDays(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_WORK_DAY) * 10) / 10;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export interface SickEntryInput {
  workerId: string;
  startDate: string;
  endDate: string;
  minutes: number;
  note?: string;
}

export function useLeaveQueue() {
  const t = useTranslations('Leave');
  const trpc = useTRPC();
  const { can } = usePermissions();

  const [statusFilter, setStatusFilter] = useQueryState('status', parseAsString.withDefault('all'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState('pageSize', parseAsInteger.withDefault(25));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sickOpen, setSickOpen] = useState(false);

  const canWrite = can('employee', ['update']);

  const apiStatus =
    statusFilter === 'PENDING' || statusFilter === 'APPROVED' || statusFilter === 'REJECTED'
      ? statusFilter
      : undefined;

  const listQuery = useQuery(
    trpc.leave.listRequests.queryOptions({ status: apiStatus, page, pageSize }),
  );
  const leaveTypesQuery = useQuery(trpc.leave.leaveType.list.queryOptions());
  const employeesQuery = useQuery(trpc.employee.list.queryOptions({ take: 200 }));

  const leaveTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of leaveTypesQuery.data ?? []) map.set(type.id, type.name);
    return map;
  }, [leaveTypesQuery.data]);

  const workerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const worker of employeesQuery.data ?? [])
      map.set(worker.id, worker.displayName ?? worker.email ?? worker.id);
    return map;
  }, [employeesQuery.data]);

  const rows = useMemo<LeaveQueueRow[]>(() => {
    const items = listQuery.data?.items ?? [];
    return items.map(item => ({
      id: item.id,
      workerId: item.workerId,
      workerName: workerName.get(item.workerId) ?? item.workerId,
      leaveTypeId: item.leaveTypeId,
      leaveTypeName: leaveTypeName.get(item.leaveTypeId) ?? item.leaveTypeId,
      startDate: toIso(item.startDate),
      endDate: toIso(item.endDate),
      requestedMinutes: item.requestedMinutes,
      status: item.status as LeaveStatus,
      teamId: item.teamId ?? null,
    }));
  }, [listQuery.data, leaveTypeName, workerName]);

  const totalRows = listQuery.data?.total ?? 0;

  const selected = useMemo(
    () => rows.find(row => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const balanceQuery = useQuery({
    ...trpc.leave.getBalance.queryOptions({
      workerId: selected?.workerId ?? '',
      leaveTypeId: selected?.leaveTypeId ?? '',
    }),
    enabled: sidePanelOpen && selected != null,
  });

  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data ?? []).map(worker => ({
        id: worker.id,
        name: worker.displayName ?? worker.email ?? worker.id,
      })),
    [employeesQuery.data],
  );

  const leaveInvalidate = [
    [['leave', 'listRequests']] as const,
    [['leave', 'getBalance']] as const,
  ];

  const sickMutation = useResourceMutation(trpc.leave.recordSickAbsence.mutationOptions(), {
    invalidate: leaveInvalidate,
    successMessage: t('toast.sickRecorded'),
    errorMessage: t('toast.sickError'),
    onClose: () => setSickOpen(false),
  });

  const handleRowClick = useCallback((row: LeaveQueueRow) => {
    setSelectedId(row.id);
    setSidePanelOpen(true);
  }, []);

  const handleSidePanelOpenChange = useCallback((open: boolean) => {
    setSidePanelOpen(open);
    if (!open) setSelectedId(null);
  }, []);

  const handleStatusChange = useCallback(
    (next: string) => {
      void setStatusFilter(next);
      void setPage(1);
    },
    [setStatusFilter, setPage],
  );

  const handlePageChange = useCallback((next: number) => void setPage(next + 1), [setPage]);
  const handlePageSizeChange = useCallback(
    (next: number) => {
      void setPageSize(next);
      void setPage(1);
    },
    [setPageSize, setPage],
  );
  const handleClearFilters = useCallback(() => {
    void setStatusFilter('all');
  }, [setStatusFilter]);

  const handleRecordSick = useCallback(
    (input: SickEntryInput) => sickMutation.mutate(input),
    [sickMutation],
  );

  const isLoading = listQuery.isLoading;
  const isError = listQuery.isError;
  const isEmpty = !(isLoading || isError) && rows.length === 0;
  const hasActiveFilters = statusFilter !== 'all';

  const availableMinutes = balanceQuery.data?.availableMinutes ?? null;
  const remainingMinutes =
    availableMinutes != null && selected != null
      ? availableMinutes - selected.requestedMinutes
      : null;

  return {
    canWrite,
    isLoading,
    isError,
    isEmpty,
    hasActiveFilters,
    statusFilter,
    onStatusChange: handleStatusChange,
    onRetry: () => void listQuery.refetch(),
    onClearFilters: handleClearFilters,
    sickOpen,
    onSickOpenChange: setSickOpen,
    onRecordSick: handleRecordSick,
    isRecordingSick: sickMutation.isPending,
    employeeOptions,
    queueProps: {
      rows,
      totalRows,
      page: page - 1,
      pageSize,
      isLoading,
      onPageChange: handlePageChange,
      onPageSizeChange: handlePageSizeChange,
      onRowClick: handleRowClick,
    },
    sidePanel: {
      open: sidePanelOpen,
      onOpenChange: handleSidePanelOpenChange,
      request: selected,
      balanceLoading: balanceQuery.isLoading && sidePanelOpen && selected != null,
      availableMinutes,
      remainingMinutes,
    },
  } as const;
}
