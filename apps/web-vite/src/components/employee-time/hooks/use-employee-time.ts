import { useQuery } from '@tanstack/react-query';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo, useState } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type AbsenceKind =
  | 'VACATION'
  | 'SICK'
  | 'PARENTAL'
  | 'BEREAVEMENT'
  | 'STUDY'
  | 'UNPAID'
  | 'OTHER_JUSTIFIED'
  | 'UNJUSTIFIED';

export type WtFindingLevel = 'approaching' | 'breach';

export interface WtFinding {
  level: WtFindingLevel;
  dimension: 'daily' | 'weekly' | 'night';
  limit: number;
  actual: number;
  copyKey: string;
}

export type LimitStatus = 'within' | 'approaching' | 'breached';

export interface TimeEntryDraft {
  workDate: string;
  workedMinutes: number;
  nightMinutes: number;
  overtimeMinutes50: number;
  overtimeMinutes100: number;
  weekendHolidayMinutes: number;
  onCallMinutes: number;
  onCallLocation?: string;
  absenceKind?: AbsenceKind;
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

function isoDay(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function limitStatusFromFindings(findings: WtFinding[]): LimitStatus {
  if (findings.some(f => f.level === 'breach')) return 'breached';
  if (findings.some(f => f.level === 'approaching')) return 'approaching';
  return 'within';
}

export function useEmployeeTime() {
  const t = useTranslations('EmployeeTime');
  const trpc = useTRPC();
  const { can } = usePermissions();

  const [workerId, setWorkerId] = useQueryState('worker', parseAsString.withDefault(''));
  const [formOpen, setFormOpen] = useState(false);
  const [findings, setFindings] = useState<WtFinding[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const canWrite = can('employee', ['update']);

  const employeesQuery = useQuery(trpc.employee.list.queryOptions({ take: 200 }));
  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data ?? []).map(worker => ({
        id: worker.id,
        name: worker.displayName ?? worker.email ?? worker.id,
      })),
    [employeesQuery.data],
  );

  const activeWorkerId = workerId || employeeOptions[0]?.id || '';
  const activeWorkerName = employeeOptions.find(w => w.id === activeWorkerId)?.name ?? '';

  const now = useMemo(() => new Date(), []);
  const weekStart = isoDay(startOfWeek(now, { weekStartsOn: 1 }));
  const monthStart = isoDay(startOfMonth(now));
  const monthEnd = isoDay(endOfMonth(now));

  const hasWorker = activeWorkerId.length > 0;

  const weekSummaryQuery = useQuery({
    ...trpc.employeeTime.weekSummary.queryOptions({ workerId: activeWorkerId, weekStart }),
    enabled: hasWorker,
  });
  const recordsQuery = useQuery({
    ...trpc.employeeTime.listRecords.queryOptions({
      workerId: activeWorkerId,
      from: monthStart,
      to: monthEnd,
    }),
    enabled: hasWorker,
  });

  const records = recordsQuery.data ?? [];

  const overtimeMonthMinutes = useMemo(
    () =>
      records.reduce(
        (sum, record) => sum + record.overtimeMinutes50 + record.overtimeMinutes100,
        0,
      ),
    [records],
  );

  const weekMinutes = weekSummaryQuery.data?.totals.workedMinutes ?? 0;
  const limitStatus = limitStatusFromFindings(findings);

  const invalidate = [
    [['employeeTime', 'listRecords']] as const,
    [['employeeTime', 'weekSummary']] as const,
  ];

  const upsert = useResourceMutation(
    {
      ...trpc.employeeTime.upsertRecord.mutationOptions(),
      onSuccess: data => {
        setFindings(data.findings as WtFinding[]);
        setBannerDismissed(data.findings.length === 0);
        setFormOpen(false);
      },
    },
    {
      invalidate,
      successMessage: t('toast.saved'),
      errorMessage: t('error.message'),
    },
  );

  const handleSaveEntry = useCallback(
    (draft: TimeEntryDraft) => {
      if (!hasWorker) return;
      upsert.mutate({
        workerId: activeWorkerId,
        workDate: draft.workDate,
        workedMinutes: draft.workedMinutes,
        nightMinutes: draft.nightMinutes,
        overtimeMinutes50: draft.overtimeMinutes50,
        overtimeMinutes100: draft.overtimeMinutes100,
        weekendHolidayMinutes: draft.weekendHolidayMinutes,
        onCallMinutes: draft.onCallMinutes,
        onCallLocation: draft.onCallLocation,
        absenceKind: draft.absenceKind,
        wtOptOut: false,
        source: 'MANUAL',
      });
    },
    [upsert, activeWorkerId, hasWorker],
  );

  const handleWorkerChange = useCallback(
    (next: string) => {
      void setWorkerId(next);
      setFindings([]);
      setBannerDismissed(true);
    },
    [setWorkerId],
  );

  const isLoading = employeesQuery.isLoading || (hasWorker && recordsQuery.isLoading);
  const isError = recordsQuery.isError || weekSummaryQuery.isError;
  const isEmpty = !isLoading && employeeOptions.length === 0;

  const showBanner = findings.length > 0 && !bannerDismissed;

  return {
    canWrite,
    isLoading,
    isError,
    isEmpty,
    hasWorker,
    onRetry: () => {
      void recordsQuery.refetch();
      void weekSummaryQuery.refetch();
    },
    workerId: activeWorkerId,
    workerName: activeWorkerName,
    employeeOptions,
    onWorkerChange: handleWorkerChange,
    formOpen,
    onFormOpenChange: setFormOpen,
    onSaveEntry: handleSaveEntry,
    isSaving: upsert.isPending,
    summary: {
      weekMinutes,
      overtimeMonthMinutes,
      limitStatus,
    },
    records,
    findings,
    showBanner,
    onDismissBanner: () => setBannerDismissed(true),
  } as const;
}
