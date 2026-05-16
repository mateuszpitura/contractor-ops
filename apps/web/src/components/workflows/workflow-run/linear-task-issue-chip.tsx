'use client';

import { useQuery } from '@tanstack/react-query';
import { LinearIssueChip } from '@/components/integrations/linear-issue-chip';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LinearStatusType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

interface LinearIssueMetadataShape {
  identifier: string;
  title: string;
  status: string;
  statusType: LinearStatusType;
  url: string;
}

interface LinearTaskIssueChipProps {
  taskRunId: string;
}

// ---------------------------------------------------------------------------
// LinearTaskIssueChip
// ---------------------------------------------------------------------------

/**
 * Inline chip rendering the Linear issue linked to a single workflow task
 * run. Hidden when Linear is not connected, the task has no linked issue,
 * or the issue metadata is unavailable.
 *
 * Powered by `linear.getLinkedIssue` (single-task lookup).
 */
export function LinearTaskIssueChip({ taskRunId }: LinearTaskIssueChipProps) {
  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const linkedQuery = useQuery({
    ...trpc.linear.getLinkedIssue.queryOptions({ taskRunId }),
    enabled: !!connectionQuery.data,
  });

  if (!connectionQuery.data) return null;
  const link = linkedQuery.data;
  if (!link) return null;

  const metadata = link.metadata as LinearIssueMetadataShape | null;
  if (!metadata) return null;

  return (
    <LinearIssueChip
      identifier={metadata.identifier}
      title={metadata.title}
      status={metadata.status}
      statusType={metadata.statusType}
      url={metadata.url ?? link.externalUrl ?? '#'}
    />
  );
}
