/**
 * RunHeader — presentational title bar + actions for workflow run detail.
 */

import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Link } from '../../../i18n/navigation.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import type { RunHeaderRun, useRunHeader } from '../hooks/use-run-header.js';
import { getDaysOverdue } from '../hooks/use-run-header.js';

type RunHeaderProps = {
  run: RunHeaderRun;
  showActions: boolean;
} & ReturnType<typeof useRunHeader>;

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

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setReason('');
        setAcknowledged(false);
      }
    },
    [onOpenChange],
  );

  const handleReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value),
    [],
  );

  const handleAcknowledgeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setAcknowledged(e.target.checked),
    [],
  );

  const handleConfirmClick = useCallback(() => onConfirm(reason.trim()), [onConfirm, reason]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
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
              onChange={handleReasonChange}
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
              onChange={handleAcknowledgeChange}
            />
            <span>{t('acknowledge')}</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={reason.trim().length < 20 || !acknowledged || isPending}
              onClick={handleConfirmClick}>
              {t('confirmCta')}
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RunHeader({
  run,
  progress,
  isOverdue,
  showOverride,
  showActions,
  canCancel,
  cancelOpen,
  setCancelOpen,
  overrideOpen,
  setOverrideOpen,
  cancelMutation,
  overrideMutation,
  handleCancel,
  handleOverride,
}: RunHeaderProps) {
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');
  const tOverride = useTranslations('Workflows.overrideBlockingTask');
  const { formatDate } = useDateFormatter();

  const handleOpenOverride = useCallback(() => setOverrideOpen(true), [setOverrideOpen]);
  const handleOpenCancel = useCallback(() => setCancelOpen(true), [setCancelOpen]);
  const renderMenuTrigger = useCallback(
    (props: React.ComponentPropsWithoutRef<typeof Button>) => (
      <Button {...props} variant="ghost" size="icon">
        <MoreHorizontal className="size-4" />
        <span className="sr-only">{tCommon('srOnly.actions')}</span>
      </Button>
    ),
    [tCommon],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[20px] font-display font-semibold leading-[1.2] tracking-tight">
              {run.workflowTemplate?.name ?? t('workflowLabel')}
            </h1>
            <AtelierStatusPill
              variant={statusToVariant(
                'workflow-run',
                run.status as Parameters<typeof statusToVariant<'workflow-run'>>[1],
              )}>
              {tDynLoose(t, 'runStatus', enumKey(run.status))}
            </AtelierStatusPill>
          </div>

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

        {!!showActions && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger render={renderMenuTrigger} />
              <DropdownMenuContent align="end">
                {!!showOverride && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={handleOpenOverride}>
                    <AlertTriangle className="me-2 size-4" />
                    {tOverride('menuItem')}
                  </DropdownMenuItem>
                )}
                {!!canCancel && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={handleOpenCancel}>
                    {t('cancelWorkflow')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <AlertDialogContent>
                <AlertDialogTitle>{t('cancelWorkflowTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('cancelWorkflowBody')}</AlertDialogDescription>
                <div className="flex justify-end gap-2 pt-2">
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}>
                    {t('cancelWorkflowCta')}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>

            <OverrideBlockingTaskDialog
              runId={run.id}
              open={overrideOpen}
              onOpenChange={setOverrideOpen}
              isPending={overrideMutation.isPending}
              onConfirm={handleOverride}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Progress
          value={progress.percent}
          aria-label={t('progressLabel', { completed: progress.done, total: progress.total })}
          className="[&_[data-slot=progress-track]]:h-2">
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
