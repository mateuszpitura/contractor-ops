'use client';

import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { usePermissionsServer } from '@/hooks/use-permissions-server';
import { Link } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunTask {
  status: string;
  resultJson?: unknown;
  isOverdue?: boolean;
  /**
   * Optional task-type discriminator — used by the Phase 74 Plan 08 override
   * dialog to detect open IP_VERIFICATION tasks. Other consumers of this
   * shape can leave it undefined; the override CTA simply won't surface.
   */
  taskType?: string;
}

interface RunHeaderProps {
  run: {
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
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateRunProgress(tasks: RunTask[]) {
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

function getDaysOverdue(dueDate: string | Date): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Override-blocking-task dialog (extracted to keep RunHeader below the cognitive-complexity ceiling)
// ---------------------------------------------------------------------------

interface OverrideBlockingTaskDialogProps {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: (reason: string) => void;
}

function OverrideBlockingTaskDialog({
  runId,
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: OverrideBlockingTaskDialogProps) {
  const t = useTranslations('Workflows.overrideBlockingTask');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <AlertDialog
      open={open}
      // biome-ignore lint/nursery/noJsxPropsBind: AlertDialog onOpenChange resets local form state
      onOpenChange={isOpen => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setReason('');
          setAcknowledged(false);
        }
      }}>
      <AlertDialogContent>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <AlertDialogTitle>{t('title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('body')}</AlertDialogDescription>
            </div>
          </div>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">
            {t('warning')}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`run-${runId}-override-reason`} className="text-[12px] font-medium">
              {t('reasonLabel')}
            </label>
            <Textarea
              id={`run-${runId}-override-reason`}
              value={reason}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="min-h-[100px]"
              maxLength={2000}
            />
            <p className="text-[12px] text-muted-foreground">
              {t('reasonHelp', { min: 20, max: 2000 })}
            </p>
          </div>

          <label className="flex items-start gap-2 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acknowledged}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setAcknowledged(e.target.checked)}
            />
            <span>{t('acknowledge')}</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={reason.trim().length < 20 || !acknowledged || isPending}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => onConfirm(reason.trim())}>
              {t('confirmCta')}
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RunHeader({ run }: RunHeaderProps) {
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');
  const tOverride = useTranslations('Workflows.overrideBlockingTask');
  const { formatDate } = useDateFormatter();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);

  // Plan 74-08 override-blocking-task dialog state. The reason / acknowledged
  // form state itself lives inside OverrideBlockingTaskDialog so this header
  // only tracks the open/closed flag.
  const [overrideOpen, setOverrideOpen] = useState(false);

  // Server-derived permission lookup — the override action is gated on the
  // server-side `workflow:override_blocking_task` action (owner role only).
  // Belt-and-suspenders UI gating matches the requirePermission middleware.
  const { can } = usePermissionsServer();
  const canOverride = can('workflow', ['override_blocking_task']);

  // Show the override CTA only when the run has at least one open
  // IP_VERIFICATION task (the only task type the BE currently allows to be
  // overridden — falls through to PRECONDITION_FAILED otherwise).
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

  const cancelMutation = useMutation(
    trpc.workflow.cancelRun.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastWorkflowCancelled'));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: run.id }),
        });
        setCancelOpen(false);
      },
      onError: () => {
        toast.error(t('errors.failedToLoadWorkflowDetail'));
      },
    }),
  );

  const overrideMutation = useMutation(
    trpc.workflow.overrideBlockingTask.mutationOptions({
      onSuccess: () => {
        toast.success(tOverride('toastSuccess'));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: run.id }),
        });
        setOverrideOpen(false);
      },
      onError: err => {
        toast.error(err.message || tOverride('toastFailure'));
      },
    }),
  );

  const canCancel = run.status !== 'COMPLETED' && run.status !== 'CANCELLED';

  return (
    <div className="space-y-4">
      {/* Top row: title + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Workflow name */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[20px] font-display font-semibold leading-[1.2] tracking-tight">
              {run.workflowTemplate?.name ?? t('workflowLabel')}
            </h1>
            <AtelierStatusPill
              variant={statusToVariant(
                'workflow-run',
                run.status as Parameters<typeof statusToVariant<'workflow-run'>>[1],
              )}>
              {t(`runStatus.${enumKey(run.status)}` as Parameters<typeof t>[0])}
            </AtelierStatusPill>
          </div>

          {/* Template + contractor links */}
          <div className="flex items-center gap-3 flex-wrap text-sm">
            {!!run.workflowTemplate && (
              <Link
                href={`/workflows/templates/${run.workflowTemplate.id}`}
                className="text-primary hover:underline">
                {run.workflowTemplate.name}
              </Link>
            )}
            {!!run.contractor && (
              <>
                <span className="text-muted-foreground">&middot;</span>
                <span className="text-muted-foreground">{t('contractorLabel')}</span>
                <Link
                  href={`/contractors/${run.contractor.id}`}
                  className="text-primary hover:underline">
                  {run.contractor.displayName ?? run.contractor.legalName}
                </Link>
              </>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 flex-wrap text-[13px] text-muted-foreground">
            {!!run.startedAt && (
              <span>
                {t('startedByLabel', {
                  name: run.startedByUserId ?? 'Unknown',
                  date: formatDate(run.startedAt),
                })}
              </span>
            )}
            {!!run.dueAt && (
              <>
                <span>&middot;</span>
                {isOverdue ? (
                  <span className="text-destructive font-medium">
                    {t('overdueLabel', { count: getDaysOverdue(run.dueAt) })}
                  </span>
                ) : (
                  <span>{t('dueDateLabel', { date: formatDate(run.dueAt) })}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions dropdown */}
        {!!(canCancel || showOverride) && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={props => (
                  <Button {...props} variant="ghost" size="icon">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">{tCommon('srOnly.actions')}</span>
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                {!!showOverride && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    // biome-ignore lint/nursery/noJsxPropsBind: dropdown item handler
                    onSelect={() => setOverrideOpen(true)}>
                    <AlertTriangle className="me-2 size-4" />
                    {tOverride('menuItem')}
                  </DropdownMenuItem>
                )}
                {!!canCancel && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    // biome-ignore lint/nursery/noJsxPropsBind: dropdown item handler
                    onSelect={() => setCancelOpen(true)}>
                    {t('cancelWorkflow')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cancel-run AlertDialog */}
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <AlertDialogContent>
                <AlertDialogTitle>{t('cancelWorkflowTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('cancelWorkflowBody')}</AlertDialogDescription>
                <div className="flex justify-end gap-2 pt-2">
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() => {
                      cancelMutation.mutate({ runId: run.id });
                    }}
                    disabled={cancelMutation.isPending}>
                    {t('cancelWorkflowCta')}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>

            {/* Override-blocking-task AlertDialog (Phase 74 Plan 08) */}
            <OverrideBlockingTaskDialog
              runId={run.id}
              open={overrideOpen}
              onOpenChange={setOverrideOpen}
              isPending={overrideMutation.isPending}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onConfirm={reason =>
                overrideMutation.mutate({
                  workflowRunId: run.id,
                  reason,
                  acknowledged: true,
                })
              }
            />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={progress.percent} className="[&_[data-slot=progress-track]]:h-2">
          <span className="text-[13px] text-muted-foreground">
            {t('progressLabel', {
              completed: progress.done,
              total: progress.total,
            })}
          </span>
        </Progress>
      </div>
    </div>
  );
}
