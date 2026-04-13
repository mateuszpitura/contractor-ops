'use client';

import { useQuery } from '@tanstack/react-query';
import { GitBranch, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { JiraActivitySummary } from '@/components/integrations/jira-activity-summary';
import { JiraIssueChip } from '@/components/integrations/jira-issue-chip';
import { LinearIssueChip } from '@/components/integrations/linear-issue-chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplatePicker } from '@/components/workflows/template-picker-dialog';
import { Link } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Run status badge styling (matching UI-SPEC)
// ---------------------------------------------------------------------------

const runStatusBadgeColors: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground border border-border',
  IN_PROGRESS: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-green-500/10 text-green-600 dark:text-green-400',
  CANCELLED: 'bg-muted text-muted-foreground border border-border',
  BLOCKED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  OVERDUE: 'bg-destructive/10 text-destructive',
};

// ---------------------------------------------------------------------------
// Row type matching tRPC response
// ---------------------------------------------------------------------------

type WorkflowRunRow = {
  id: string;
  status: string;
  startedAt: string | null;
  workflowTemplate: {
    name: string;
    type: string;
  } | null;
  progress: {
    done: number;
    total: number;
    percent: number;
  };
};

// ---------------------------------------------------------------------------
// Linked issue type from metadataJson
// ---------------------------------------------------------------------------

interface LinkedIssueData {
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

// ---------------------------------------------------------------------------
// Linked Linear issue type
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
 * Inline Linear chips for a workflow run row.
 * Shows max 3 chips with "+N more" overflow badge.
 */
function RunLinearChips({ runId }: { runId: string }) {
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

  const issues = (issuesQuery.data ?? []) as unknown as LinkedLinearIssueData[];

  if (!(connectionQuery.data && issues.length)) return null;

  const visible = issues.slice(0, 3);
  const overflow = issues.length - 3;

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
    <div className="flex items-center gap-1" role="presentation" onClick={e => e.preventDefault()}>
      {visible.map(issue => (
        <LinearIssueChip
          key={issue.id}
          identifier={issue.metadataJson.identifier}
          title={issue.metadataJson.title}
          status={issue.metadataJson.status}
          statusType={issue.metadataJson.statusType}
          url={issue.metadataJson.url ?? issue.externalUrl}
        />
      ))}
      {overflow > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{overflow} more
        </Badge>
      )}
    </div>
  );
}

/**
 * Inline Jira chips for a workflow run row.
 * Shows max 3 chips with "+N more" overflow badge.
 */
function RunJiraChips({ runId }: { runId: string }) {
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

  const issues = (issuesQuery.data ?? []) as unknown as LinkedIssueData[];

  if (!(connectionQuery.data && issues.length)) return null;

  const visible = issues.slice(0, 3);
  const overflow = issues.length - 3;

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
    <div className="flex items-center gap-1" role="presentation" onClick={e => e.preventDefault()}>
      {visible.map(issue => (
        <JiraIssueChip
          key={issue.id}
          issueKey={issue.metadataJson.key}
          summary={issue.metadataJson.summary}
          status={issue.metadataJson.status}
          statusCategory={issue.metadataJson.statusCategory}
          url={issue.metadataJson.url ?? issue.externalUrl}
        />
      ))}
      {overflow > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{overflow} more
        </Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WorkflowsTabProps = {
  contractorId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowsTab({ contractorId }: WorkflowsTabProps) {
  const t = useTranslations('Workflows');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const runsQuery = useQuery(
    trpc.workflow.listRuns.queryOptions({
      contractorId,
      page,
      pageSize,
      sortBy: 'startedAt',
      sortOrder: 'desc',
    }),
  );

  const queryData = runsQuery.data;
  const items: WorkflowRunRow[] = useMemo(
    () => (queryData?.items ?? []) as unknown as WorkflowRunRow[],
    [queryData],
  );
  const totalCount: number = queryData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Loading state
  if (runsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0 && !runsQuery.isLoading) {
    return (
      <>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
          <GitBranch className="size-10 text-muted-foreground/50" />
          <h4 className="text-sm font-medium">{t('contractorNoWorkflows')}</h4>
          <p className="max-w-sm text-sm text-muted-foreground">{t('contractorNoWorkflowsBody')}</p>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="me-1.5 size-3.5" />
            {t('contractorNoWorkflowsCta')}
          </Button>
        </div>
        <TemplatePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          contractorId={contractorId}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Jira activity summary (renders null when no data) */}
      <JiraActivitySummary contractorId={contractorId} />

      {/* Header with CTA */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('contractorWorkflowsTab')}</h3>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="me-1.5 size-3.5" />
          {t('contractorStartWorkflow')}
        </Button>
      </div>

      {/* Runs list */}
      <div className="space-y-2">
        {items.map(run => (
          <Link
            key={run.id}
            href={`/workflows/${run.id}`}
            className="flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {run.workflowTemplate?.name ?? 'Workflow'}
              </p>
            </div>
            <Badge variant="secondary" className={runStatusBadgeColors[run.status] ?? ''}>
              {t(`runStatus.${enumKey(run.status)}` as Parameters<typeof t>[0])}
            </Badge>
            <RunJiraChips runId={run.id} />
            <RunLinearChips runId={run.id} />
            <span className="text-sm tabular-nums text-muted-foreground">
              {run.progress.done}/{run.progress.total}
            </span>
            {!!run.startedAt && (
              <span className="text-sm text-muted-foreground">
                {new Date(run.startedAt).toLocaleDateString('pl-PL')}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Simple pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setPage(p => Math.max(1, p - 1))}>
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            &raquo;
          </Button>
        </div>
      )}

      {/* Template picker dialog */}
      <TemplatePicker open={pickerOpen} onOpenChange={setPickerOpen} contractorId={contractorId} />
    </div>
  );
}
