import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfISOWeek, startOfMonth } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalTime() {
  const t = useTranslations('Portal.timeTracking');
  const trpc = usePortalTRPC();

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfISOWeek(new Date()));
  const [singleEntryOpen, setSingleEntryOpen] = useState(false);
  const openSingleEntry = useCallback(() => setSingleEntryOpen(true), []);

  const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
  const timesheetQueryKey = trpc.portalTime.getTimesheet.queryOptions({ weekStartDate: weekStartStr })
    .queryKey;
  const listTimesheetsQueryKey = trpc.portalTime.listTimesheets.queryOptions({ limit: 10 }).queryKey;

  const timesheetQuery = useQuery(
    trpc.portalTime.getTimesheet.queryOptions({ weekStartDate: weekStartStr }),
  );

  const contractsQuery = useQuery(trpc.portalTime.getActiveContracts.queryOptions());
  const providersQuery = useQuery(trpc.portalTime.getConnectedProviders.queryOptions());
  const historyQuery = useQuery(trpc.portalTime.listTimesheets.queryOptions({ limit: 10 }));

  const currentWeekMinutes = timesheetQuery.data?.totalMinutes ?? 0;

  const pendingCount = useMemo(() => {
    if (!historyQuery.data?.items) return 0;
    return historyQuery.data.items.filter(ts => ts.status === 'SUBMITTED').length;
  }, [historyQuery.data]);

  const approvedMonthMinutes = useMemo(() => {
    if (!historyQuery.data?.items) return 0;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    return historyQuery.data.items
      .filter(ts => {
        if (ts.status !== 'APPROVED') return false;
        const d = new Date(ts.weekStartDate);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, ts) => sum + ts.totalMinutes, 0);
  }, [historyQuery.data]);

  const connectedProviders = useMemo(() => {
    const set = new Set<string>();
    for (const p of providersQuery.data ?? []) {
      set.add(p.provider);
    }
    return set;
  }, [providersQuery.data]);

  const saveDraftMutation = useResourceMutation(
    trpc.portalTime.saveDraftEntries.mutationOptions(),
    {
      successMessage: t('toast.weekSaved'),
      invalidate: [{ queryKey: timesheetQueryKey }],
    },
  );

  const createSingleEntryMutation = useResourceMutation(
    trpc.portalTime.createSingleEntry.mutationOptions(),
    {
      successMessage: t('toast.entryAdded'),
      errorMessage: t('toast.entryAddFailed'),
      invalidate: [{ queryKey: timesheetQueryKey }, { queryKey: listTimesheetsQueryKey }],
      onClose: () => setSingleEntryOpen(false),
    },
  );

  const submitMutation = useResourceMutation(
    trpc.portalTime.submitTimesheet.mutationOptions(),
    {
      successMessage: t('toast.timesheetSubmitted'),
      errorMessage: t('toast.timesheetSubmitFailed'),
      invalidate: [{ queryKey: timesheetQueryKey }, { queryKey: listTimesheetsQueryKey }],
    },
  );

  const syncMutation = useResourceMutation(
    trpc.portalTime.syncExternal.mutationOptions(),
    {
      successMessage: t('toast.synced'),
      invalidate: [{ queryKey: timesheetQueryKey }, { queryKey: listTimesheetsQueryKey }],
    },
  );

  const handleWeekChange = useCallback((date: Date) => {
    setCurrentWeekStart(startOfISOWeek(date));
  }, []);

  const handleSubmitTimesheet = useCallback(() => {
    if (!timesheetQuery.data?.id) return;
    submitMutation.mutate({ timesheetId: timesheetQuery.data.id });
  }, [timesheetQuery.data?.id, submitMutation]);

  const handleSaveEntries = useCallback(
    (
      entries: Array<{
        id?: string;
        contractId: string;
        entryDate: string;
        minutes: number;
        description?: string;
      }>,
    ) => {
      if (!timesheetQuery.data?.id) return;
      saveDraftMutation.mutate({
        timesheetId: timesheetQuery.data.id,
        entries,
      });
    },
    [timesheetQuery.data?.id, saveDraftMutation],
  );

  const handleSingleEntry = useCallback(
    (entry: { contractId: string; entryDate: string; minutes: number; description?: string }) => {
      createSingleEntryMutation.mutate(entry);
    },
    [createSingleEntryMutation],
  );

  const handleSync = useCallback(
    (provider: 'CLOCKIFY' | 'JIRA') => async (startDate: string, endDate: string) => {
      return syncMutation.mutateAsync({ provider, startDate, endDate });
    },
    [syncMutation],
  );

  const isLoading = timesheetQuery.isPending || contractsQuery.isPending;
  const isError = timesheetQuery.isError || contractsQuery.isError;
  const timesheet = timesheetQuery.data;
  const contracts = contractsQuery.data ?? [];
  const timesheetStatus = (timesheet?.status ?? 'DRAFT') as
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED';
  const isDisabled = timesheetStatus === 'SUBMITTED' || timesheetStatus === 'APPROVED';

  return {
    currentWeekStart,
    setCurrentWeekStart,
    singleEntryOpen,
    setSingleEntryOpen,
    openSingleEntry,
    historyQuery,
    currentWeekMinutes,
    pendingCount,
    approvedMonthMinutes,
    connectedProviders,
    submitMutation,
    createSingleEntryMutation,
    syncMutation,
    handleWeekChange,
    handleSubmitTimesheet,
    handleSaveEntries,
    handleSingleEntry,
    handleSync,
    isLoading,
    isError,
    timesheet,
    contracts,
    timesheetStatus,
    isDisabled,
  } as const;
}
