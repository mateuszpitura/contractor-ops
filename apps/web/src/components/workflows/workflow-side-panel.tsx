'use client';

import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { JiraIssueChip } from '@/components/integrations/jira-issue-chip';
import { LinearIssueChip } from '@/components/integrations/linear-issue-chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Status badge colors (same as columns.tsx)
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground border border-border',
  IN_PROGRESS: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-green-500/10 text-green-600 dark:text-green-400',
  CANCELLED: 'bg-muted text-muted-foreground border border-border',
  BLOCKED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  OVERDUE: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

// ---------------------------------------------------------------------------
// Linked issue type from metadataJson
// ---------------------------------------------------------------------------

interface LinkedJiraIssueData {
  id: string;
  metadataJson: {
    key: string;
    summary: string;
    status: string;
    statusCategory: 'new' | 'indeterminate' | 'done';
    url: string;
  };
  externalUrl: string;
}

/**
 * Linked Issues section for the workflow side panel.
 * Only renders when Jira is connected.
 */
function LinkedIssuesSection({ runId }: { runId: string }) {
  const connectionQuery = useQuery({
    ...trpc.jira.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const issuesQuery = useQuery({
    ...trpc.jira.linkedIssues.queryOptions({
      entityType: 'WORKFLOW_RUN',
      entityId: runId,
    }),
    enabled: !!connectionQuery.data,
  });

  // Don't render the section at all if Jira isn't connected
  if (!connectionQuery.data) return null;

  const issues = (issuesQuery.data ?? []) as unknown as LinkedJiraIssueData[];

  return (
    <>
      <Separator />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Linked Issues
        </h3>

        {issuesQuery.isLoading ? (
          // Loading skeleton: 2 rows
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={`wf-step-${i}`} className="flex items-center gap-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-6 w-[120px] rounded-md" />
              </div>
            ))}
          </div>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked Jira issues for this workflow.</p>
        ) : (
          <div className="space-y-2">
            {issues.map(issue => (
              <div key={issue.id} className="flex items-center gap-2">
                <JiraIssueChip
                  issueKey={issue.metadataJson.key}
                  summary={issue.metadataJson.summary}
                  status={issue.metadataJson.status}
                  statusCategory={issue.metadataJson.statusCategory}
                  url={issue.metadataJson.url ?? issue.externalUrl}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Linked Linear issue type from metadataJson
// ---------------------------------------------------------------------------

interface LinkedLinearIssueData {
  id: string;
  metadataJson: {
    identifier: string;
    title: string;
    status: string;
    statusType: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
    url: string;
  };
  externalUrl: string;
}

/**
 * Linked Linear Issues section for the workflow side panel.
 * Only renders when Linear is connected and has linked issues.
 */
function LinkedLinearIssuesSection({ runId }: { runId: string }) {
  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const issuesQuery = useQuery({
    ...trpc.linear.linkedIssues.queryOptions({
      entityType: 'WORKFLOW_RUN',
      entityId: runId,
    }),
    enabled: !!connectionQuery.data,
  });

  // Don't render the section at all if Linear isn't connected
  if (!connectionQuery.data) return null;

  const issues = (issuesQuery.data ?? []) as unknown as LinkedLinearIssueData[];

  if (!issuesQuery.isLoading && issues.length === 0) return null;

  return (
    <>
      <Separator />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Linear Issues
        </h3>

        {issuesQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={`wf-step-${i}`} className="flex items-center gap-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-6 w-[120px] rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map(issue => (
              <div key={issue.id} className="flex items-center gap-2">
                <LinearIssueChip
                  identifier={issue.metadataJson.identifier}
                  title={issue.metadataJson.title}
                  status={issue.metadataJson.status}
                  statusType={issue.metadataJson.statusType}
                  url={issue.metadataJson.url ?? issue.externalUrl}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WorkflowSidePanelProps {
  runId: string | null;
  onClose: () => void;
}

/**
 * Slide-out side panel showing workflow run summary.
 * Opens from right on row click. 480px on desktop, 400px on tablet.
 */
export function WorkflowSidePanel({ runId, onClose }: WorkflowSidePanelProps) {
  const t = useTranslations('Workflows');
  const ts = useTranslations('Workflows.sidePanel');

  const open = runId !== null;

  // Fetch run details when open
  const runQuery = useQuery({
    ...trpc.workflow.getRun.queryOptions({ id: runId ?? '' }),
    enabled: open && runId !== null,
  });

  const run = runQuery.data;

  // Compute task summary counts
  const taskSummary = useMemo(() => {
    if (!run?.tasks) return { done: 0, inProgress: 0, overdue: 0, total: 0 };

    const tasks = run.tasks as Array<{
      status: string;
      isOverdue: boolean;
      resultJson?: unknown;
    }>;

    // Exclude condition-skipped tasks
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
    <Sheet open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {runQuery.isLoading ? (
              // Loading skeleton
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
            ) : run ? (
              <>
                {/* Header */}
                <SheetHeader className="space-y-3">
                  <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
                    {run.workflowTemplate?.name ?? 'Workflow'}
                  </SheetTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={statusBadgeColors[run.status] ?? ''}>
                      {t(`runStatus.${run.status}` as Parameters<typeof t>[0])}
                    </Badge>
                    {run.workflowTemplate && (
                      <span className="text-sm text-muted-foreground">
                        {run.workflowTemplate.name}
                      </span>
                    )}
                  </div>
                </SheetHeader>

                <Separator />

                {/* Progress */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                    {ts('progress')}
                  </h3>
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {taskSummary.done} of {taskSummary.total} tasks complete
                  </p>
                </div>

                {/* Linked Jira Issues */}
                <LinkedIssuesSection runId={run.id} />

                {/* Linked Linear Issues (LIN-06) */}
                <LinkedLinearIssuesSection runId={run.id} />

                <Separator />

                {/* Task summary counts */}
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

                {/* Contractor */}
                {run.contractor && (
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

                {/* Started metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {run.startedAt && (
                    <div className="space-y-1">
                      <dt className="text-[13px] text-muted-foreground">{ts('startedOn')}</dt>
                      <dd>{new Date(run.startedAt).toLocaleDateString('pl-PL')}</dd>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Open workflow CTA */}
                <Button render={<Link href={`/workflows/${run.id}`} />} className="w-full">
                  {ts('openWorkflow')}
                </Button>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
