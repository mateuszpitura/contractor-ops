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
import { useState } from 'react';

import { Link } from '../../../i18n/navigation.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import type { RunHeaderRun, useRunHeader } from '../hooks/use-run-header.js';
import { getDaysOverdue } from '../hooks/use-run-header.js';

type RunHeaderProps = {
  run: RunHeaderRun;
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

export function RunHeader({
  run,
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
}: RunHeaderProps) {
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');
  const tOverride = useTranslations('Workflows.overrideBlockingTask');
  const { formatDate } = useDateFormatter();

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
