'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { LinearIssueChip } from '@/components/integrations/linear-issue-chip';
import { LinearLogo } from '@/components/integrations/linear-logo';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types — narrow client-side shape of LinearIssueMetadata
// ---------------------------------------------------------------------------

type LinearStatusType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

interface LinearIssueMetadataShape {
  identifier: string;
  title: string;
  status: string;
  statusType: LinearStatusType;
  url: string;
}

interface LinearLinkedIssue {
  id: string;
  externalId: string;
  externalUrl: string | null;
  metadata: LinearIssueMetadataShape | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinearLinkedIssuesPanelProps {
  /**
   * IDs of workflow task runs to fetch linked Linear issues for.
   *
   * NOTE: Linear linked issues are stored against `WORKFLOW_TASK_RUN` entities
   * server-side (see `linear.getLinkedIssues`). Callers that want to surface
   * issues for a contract/invoice must resolve the relevant task-run IDs
   * before passing them here.
   *
   * When the list is empty the panel renders nothing.
   */
  taskRunIds: string[];
  /** Optional heading override; defaults to the i18n title. */
  heading?: string;
  /** Limits rendered rows; defaults to 50. */
  maxRows?: number;
}

// ---------------------------------------------------------------------------
// LinearLinkedIssuesPanel
// ---------------------------------------------------------------------------

/**
 * Renders the Linear issues linked to a given set of workflow task runs.
 *
 * Hides itself entirely when Linear is not connected, when no task-run IDs
 * are supplied, or when there are zero linked issues — mirroring the Jira
 * activity-summary card pattern.
 */
export function LinearLinkedIssuesPanel({
  taskRunIds,
  heading,
  maxRows = 50,
}: LinearLinkedIssuesPanelProps) {
  const t = useTranslations('Integrations.linear.linkedIssuesPanel');

  // Stabilise the input list so identical contents do not refetch every render.
  const stableTaskRunIds = useMemo(() => Array.from(new Set(taskRunIds)).sort(), [taskRunIds]);

  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const linkedIssuesQuery = useQuery({
    ...trpc.linear.getLinkedIssues.queryOptions({ taskRunIds: stableTaskRunIds }),
    enabled: !!connectionQuery.data && stableTaskRunIds.length > 0,
  });

  // Linear not connected or no task runs supplied — render nothing so the
  // surrounding surface stays clean.
  if (!connectionQuery.data || stableTaskRunIds.length === 0) return null;

  // Loading state — small skeleton block.
  if (linkedIssuesQuery.isLoading) {
    return (
      <div className="animate-fade-up rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`linear-linked-skel-${i}`} className="flex items-center gap-2">
            <Skeleton className="h-6 w-[140px] rounded-md" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        ))}
      </div>
    );
  }

  const issuesMap = (linkedIssuesQuery.data ?? {}) as Record<string, LinearLinkedIssue | null>;

  // Flatten into a stable, sorted list — preserve caller's taskRunIds order
  // so the visual list stays predictable across refetches.
  const items: Array<{ taskRunId: string; issue: LinearLinkedIssue }> = [];
  for (const taskRunId of stableTaskRunIds) {
    const issue = issuesMap[taskRunId];
    if (issue) items.push({ taskRunId, issue });
    if (items.length >= maxRows) break;
  }

  if (items.length === 0) return null;

  return (
    <section className="animate-fade-up rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <LinearLogo className="size-4" />
        <h4 className="text-sm font-semibold">{heading ?? t('title')}</h4>
        <span className="ms-auto text-xs text-muted-foreground">
          {t('count', { count: items.length })}
        </span>
      </div>

      <ul className="space-y-2">
        {items.map(({ taskRunId, issue }) => {
          const metadata = issue.metadata;
          if (!metadata) return null;
          return (
            <li key={taskRunId} className="flex items-center gap-2">
              <LinearIssueChip
                identifier={metadata.identifier}
                title={metadata.title}
                status={metadata.status}
                statusType={metadata.statusType}
                url={metadata.url ?? issue.externalUrl ?? '#'}
              />
              <span className="flex-1 mx-2 text-sm text-muted-foreground truncate">
                {metadata.title}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
