import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { workflowTaskSkipReason } from '@contractor-ops/validators';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { Link } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { formatDate } from '../../lib/format-date.js';
import { LinkedJiraIssuesSection } from './workflow-side-panel-linked-jira-container.js';
import { LinkedLinearIssuesSection } from './workflow-side-panel-linked-linear-container.js';

const statusBadgeColors: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground border border-border',
  IN_PROGRESS: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  CANCELLED: 'bg-muted text-muted-foreground border border-border',
  BLOCKED: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  OVERDUE: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export type WorkflowSidePanelRun = {
  id: string;
  status: string;
  startedAt?: Date | string | null;
  workflowTemplate?: { name: string } | null;
  contractor?: {
    id: string;
    displayName?: string | null;
    legalName: string;
  } | null;
  tasks?: Array<{
    status: string;
    isOverdue: boolean;
    resultJson?: unknown;
  }>;
};

interface WorkflowSidePanelShellProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function WorkflowSidePanelShell({ open, onClose, children }: WorkflowSidePanelShellProps) {
  return (
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
    <Sheet open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">{children}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function WorkflowSidePanelSkeleton() {
  return (
    <>
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-2 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-28" />
      </div>
    </>
  );
}

interface WorkflowSidePanelErrorProps {
  onRetry: () => void;
}

export function WorkflowSidePanelError({ onRetry }: WorkflowSidePanelErrorProps) {
  const t = useTranslations('Workflows');
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-medium">{t('errors.failedToLoadWorkflowDetail')}</h2>
      <Button variant="outline" onClick={onRetry}>
        {t('errors.retry')}
      </Button>
    </div>
  );
}

interface WorkflowSidePanelContentProps {
  run: WorkflowSidePanelRun;
}

export function WorkflowSidePanelContent({ run }: WorkflowSidePanelContentProps) {
  const t = useTranslations('Workflows');
  const ts = useTranslations('Workflows.sidePanel');

  const taskSummary = useMemo(() => {
    if (!run.tasks) return { done: 0, inProgress: 0, overdue: 0, total: 0 };

    const tasks = run.tasks;

    const activeTasks = tasks.filter(task => {
      if (
        task.status === 'SKIPPED' &&
        (task.resultJson as Record<string, unknown>)?.skipReason ===
          workflowTaskSkipReason.conditionNotMet
      ) {
        return false;
      }
      return true;
    });

    const done = activeTasks.filter(
      task => task.status === 'DONE' || task.status === 'SKIPPED',
    ).length;
    const inProgress = activeTasks.filter(task => task.status === 'IN_PROGRESS').length;
    const overdue = activeTasks.filter(task => task.isOverdue).length;

    return { done, inProgress, overdue, total: activeTasks.length };
  }, [run]);

  const progressPercent =
    taskSummary.total > 0 ? Math.round((taskSummary.done / taskSummary.total) * 100) : 0;

  return (
    <>
      <SheetHeader className="space-y-3">
        <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
          {run.workflowTemplate?.name ?? 'Workflow'}
        </SheetTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={statusBadgeColors[run.status] ?? ''}>
            {tDynLoose(t, 'runStatus', enumKey(run.status))}
          </Badge>
          {!!run.workflowTemplate && (
            <span className="text-sm text-muted-foreground">{run.workflowTemplate.name}</span>
          )}
        </div>
      </SheetHeader>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
          {ts('progress')}
        </h3>
        <Progress value={progressPercent} className="h-2" />
        <p className="text-sm text-muted-foreground">
          {ts('tasksComplete', {
            done: taskSummary.done,
            total: taskSummary.total,
          })}
        </p>
      </div>

      <LinkedJiraIssuesSection runId={run.id} />
      <LinkedLinearIssuesSection runId={run.id} />

      <Separator />

      <div className="space-y-3">
        <p className="text-sm">
          {ts('tasksSummary', {
            done: taskSummary.done,
            inProgress: taskSummary.inProgress,
            overdue: taskSummary.overdue,
          })}
        </p>
      </div>

      <Separator />

      {!!run.contractor && (
        <>
          <div className="space-y-2">
            <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
              {ts('contractor')}
            </h3>
            <Link
              href={`/contractors/${run.contractor.id}`}
              className="text-sm text-primary hover:underline">
              {run.contractor.displayName ?? run.contractor.legalName}
            </Link>
          </div>

          <Separator />
        </>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {!!run.startedAt && (
          <div className="space-y-1">
            <dt className="text-[13px] text-muted-foreground">{ts('startedOn')}</dt>
            <dd>{formatDate(run.startedAt)}</dd>
          </div>
        )}
      </div>

      <Separator />

      <Button render={<Link href={`/workflows/${run.id}`} />} className="w-full">
        {ts('openWorkflow')}
      </Button>
    </>
  );
}

/**
 * Legacy combined view kept for tests that construct full prop bag; render
 * path per variant picked here, mirroring container logic.
 */
interface WorkflowSidePanelViewProps {
  runId: string | null;
  run: WorkflowSidePanelRun | undefined;
  isLoading: boolean;
  isError: boolean;
  handleRetry: () => void;
  onClose: () => void;
}

export function WorkflowSidePanelView({
  runId,
  run,
  isLoading,
  isError,
  handleRetry,
  onClose,
}: WorkflowSidePanelViewProps) {
  const open = runId !== null;

  let body: ReactNode = null;
  if (isLoading) {
    body = <WorkflowSidePanelSkeleton />;
  } else if (isError) {
    body = <WorkflowSidePanelError onRetry={handleRetry} />;
  } else if (run) {
    body = <WorkflowSidePanelContent run={run} />;
  }

  return (
    <WorkflowSidePanelShell open={open} onClose={onClose}>
      {body}
    </WorkflowSidePanelShell>
  );
}
