import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';

import { usePermissions } from '../../../../hooks/use-permissions.js';
import { useResourceMutation } from '../../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export interface EwidencjaSnapshot {
  id: string;
  periodKey: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  version: number;
  status: string;
  previousSnapshotId: string | null;
  generatedByUserId: string | null;
  createdAt: string | Date;
}

export interface EwidencjaPeriodRow {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  active: EwidencjaSnapshot;
  superseded: EwidencjaSnapshot[];
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function useEwidencja() {
  const t = useTranslations('Ewidencja');
  const trpc = useTRPC();
  const { can } = usePermissions();

  const [workerId, setWorkerId] = useQueryState('worker', parseAsString.withDefault(''));
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
  const hasWorker = activeWorkerId.length > 0;

  const listQuery = useQuery({
    ...trpc.ewidencja.list.queryOptions({ workerId: activeWorkerId }),
    enabled: hasWorker,
  });

  const periods = useMemo<EwidencjaPeriodRow[]>(() => {
    const snapshots = (listQuery.data ?? []) as EwidencjaSnapshot[];
    const byPeriod = new Map<string, EwidencjaSnapshot[]>();
    for (const snapshot of snapshots) {
      const bucket = byPeriod.get(snapshot.periodKey);
      if (bucket) bucket.push(snapshot);
      else byPeriod.set(snapshot.periodKey, [snapshot]);
    }
    return [...byPeriod.entries()]
      .map(([periodKey, versions]) => {
        const sorted = [...versions].sort((a, b) => b.version - a.version);
        const active = sorted[0];
        return {
          periodKey,
          periodStart: toIso(active.periodStart),
          periodEnd: toIso(active.periodEnd),
          active,
          superseded: sorted.slice(1),
        };
      })
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  }, [listQuery.data]);

  const generate = useResourceMutation(trpc.ewidencja.generate.mutationOptions(), {
    invalidate: [[['ewidencja', 'list']] as const],
    successMessage: t('toast.generated'),
  });

  const regenerate = useResourceMutation(trpc.ewidencja.generate.mutationOptions(), {
    invalidate: [[['ewidencja', 'list']] as const],
    successMessage: t('toast.regenerated'),
  });

  const handleWorkerChange = useCallback((next: string) => void setWorkerId(next), [setWorkerId]);

  const handleGenerate = useCallback(
    (periodStart: string, periodEnd: string) => {
      if (!hasWorker) return;
      generate.mutate({ workerId: activeWorkerId, periodStart, periodEnd });
    },
    [generate, activeWorkerId, hasWorker],
  );

  const handleRegenerate = useCallback(
    (period: EwidencjaPeriodRow) => {
      if (!hasWorker) return;
      regenerate.mutate({
        workerId: activeWorkerId,
        periodStart: period.periodStart.slice(0, 10),
        periodEnd: period.periodEnd.slice(0, 10),
      });
    },
    [regenerate, activeWorkerId, hasWorker],
  );

  const isLoading = employeesQuery.isLoading || (hasWorker && listQuery.isLoading);
  const isError = listQuery.isError;
  const isEmpty = !(isLoading || isError) && hasWorker && periods.length === 0;
  const noWorkers = !isLoading && employeeOptions.length === 0;

  return {
    canWrite,
    isLoading,
    isError,
    isEmpty,
    noWorkers,
    hasWorker,
    onRetry: () => void listQuery.refetch(),
    workerId: activeWorkerId,
    workerName: activeWorkerName,
    employeeOptions,
    onWorkerChange: handleWorkerChange,
    periods,
    onGenerate: handleGenerate,
    onRegenerate: handleRegenerate,
    isGenerating: generate.isPending || regenerate.isPending,
  } as const;
}
