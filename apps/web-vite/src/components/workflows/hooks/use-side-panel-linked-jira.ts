import { useCallback } from 'react';

import { useWorkflowSidePanelJiraIssues } from './use-workflow-ui.js';

export interface LinkedJiraIssueRow {
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

export function useSidePanelLinkedJira(runId: string) {
  const { connectionQuery, issuesQuery } = useWorkflowSidePanelJiraIssues(runId);

  const handleRetry = useCallback(() => {
    void issuesQuery.refetch();
  }, [issuesQuery]);

  const issues = (issuesQuery.data?.items ?? []) as unknown as LinkedJiraIssueRow[];

  return {
    showSection: !!connectionQuery.data,
    isLoading: issuesQuery.isLoading,
    isError: issuesQuery.isError,
    issues,
    handleRetry,
  } as const;
}
