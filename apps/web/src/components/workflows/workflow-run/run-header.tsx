'use client';

import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
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
// Component
// ---------------------------------------------------------------------------

export function RunHeader({ run }: RunHeaderProps) {
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');
  const { formatDate } = useDateFormatter();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);

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
        {!!canCancel && (
          <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
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
                <AlertDialogTrigger
                  // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                  render={props => (
                    <DropdownMenuItem
                      {...props}
                      className="text-destructive focus:text-destructive">
                      {t('cancelWorkflow')}
                    </DropdownMenuItem>
                  )}
                />
              </DropdownMenuContent>
            </DropdownMenu>

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
