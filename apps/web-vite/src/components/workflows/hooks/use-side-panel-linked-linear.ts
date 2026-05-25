import { useCallback } from 'react';

import { useWorkflowSidePanelLinearIssues } from './use-workflow-ui.js';

export interface LinkedLinearIssueRow {
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

export function useSidePanelLinkedLinear(runId: string) {
  const { connectionQuery, issuesQuery } = useWorkflowSidePanelLinearIssues(runId);

  const handleRetry = useCallback(() => {
    void issuesQuery.refetch();
  }, [issuesQuery]);

  const issues = (issuesQuery.data?.items ?? []) as unknown as LinkedLinearIssueRow[];

  const showSection =
    !!connectionQuery.data && (issuesQuery.isLoading || issuesQuery.isError || issues.length > 0);

  return {
    showSection,
    isLoading: issuesQuery.isLoading,
    isError: issuesQuery.isError,
    issues,
    handleRetry,
  } as const;
}
