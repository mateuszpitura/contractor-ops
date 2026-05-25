import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useCallback, useState } from 'react';

import {
  useWorkflowCancelRun,
  useWorkflowOverrideBlockingTask,
  useWorkflowRunPermissions,
} from './use-workflow-ui.js';

interface RunTask {
  status: string;
  resultJson?: unknown;
  isOverdue?: boolean;
  taskType?: string;
}

export interface RunHeaderRun {
  id: string;
  status: string;
  startedAt: string | Date | null;
  dueAt: string | Date | null;
  startedByUserId: string | null;
  workflowTemplate: {
    id: string;
    name: string;
    type: string;
  } | null;
  contractor: {
    id: string;
    legalName: string;
    displayName: string | null;
  } | null;
  tasks: RunTask[];
}

export function calculateRunProgress(tasks: RunTask[]) {
  const activeTasks = tasks.filter(t => {
    if (
      t.status === 'SKIPPED' &&
      (t.resultJson as Record<string, unknown>)?.skipReason ===
        workflowTaskSkipReason.conditionNotMet
    ) {
      return false;
    }
    return true;
  });

  const done = activeTasks.filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length;
  const total = activeTasks.length;

  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export function getDaysOverdue(dueDate: string | Date): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function useRunHeader(run: RunHeaderRun) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const permissionsQuery = useWorkflowRunPermissions();
  const permissionMap = (permissionsQuery.data ?? {}) as Record<string, string[]>;
  const canOverride = (permissionMap.workflow ?? []).includes('override_blocking_task');

  const hasOpenIpVerification = run.tasks.some(
    task =>
      task.taskType === 'IP_VERIFICATION' &&
      (task.status === 'TODO' || task.status === 'IN_PROGRESS' || task.status === 'BLOCKED'),
  );
  const showOverride =
    canOverride &&
    hasOpenIpVerification &&
    run.status !== 'COMPLETED' &&
    run.status !== 'CANCELLED';

  const progress = calculateRunProgress(run.tasks);

  const isOverdue =
    run.dueAt !== null && new Date(run.dueAt) < new Date() && run.status === 'IN_PROGRESS';

  const cancelMutation = useWorkflowCancelRun(run.id, { onSuccess: () => setCancelOpen(false) });

  const overrideMutation = useWorkflowOverrideBlockingTask(run.id, {
    onSuccess: () => setOverrideOpen(false),
  });

  const canCancel = run.status !== 'COMPLETED' && run.status !== 'CANCELLED';

  const handleCancel = useCallback(() => {
    cancelMutation.mutate({ runId: run.id });
  }, [cancelMutation, run.id]);

  const handleOverride = useCallback(
    (reason: string) => {
      overrideMutation.mutate({
        workflowRunId: run.id,
        reason,
        acknowledged: true,
      });
    },
    [overrideMutation, run.id],
  );

  return {
    progress,
    isOverdue,
    showOverride,
    canCancel,
    cancelOpen,
    setCancelOpen,
    overrideOpen,
    setOverrideOpen,
    cancelMutation,
    overrideMutation,
    handleCancel,
    handleOverride,
  } as const;
}
