import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLinearLinkedIssuesPanel(taskRunIds: string[], maxRows = 50) {
  const trpc = useTRPC();

  const stableTaskRunIds = useMemo(() => Array.from(new Set(taskRunIds)).sort(), [taskRunIds]);

  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const linkedIssuesQuery = useQuery({
    ...trpc.linear.getLinkedIssues.queryOptions({ taskRunIds: stableTaskRunIds }),
    enabled: !!connectionQuery.data && stableTaskRunIds.length > 0,
  });

  const issuesMap = (linkedIssuesQuery.data ?? {}) as Record<
    string,
    {
      id: string;
      externalId: string;
      externalUrl: string | null;
      metadata: {
        identifier: string;
        title: string;
        status: string;
        statusType: string;
        url: string;
      } | null;
    } | null
  >;

  const items: Array<{
    taskRunId: string;
    issue: NonNullable<(typeof issuesMap)[string]>;
  }> = [];

  for (const taskRunId of stableTaskRunIds) {
    const issue = issuesMap[taskRunId];
    if (issue) items.push({ taskRunId, issue });
    if (items.length >= maxRows) break;
  }

  const isVisible = !!connectionQuery.data && stableTaskRunIds.length > 0;

  return {
    isLoading: linkedIssuesQuery.isLoading,
    isVisible,
    items,
  } as const;
}
