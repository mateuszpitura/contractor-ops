import { useSidePanelLinkedJira } from './hooks/use-side-panel-linked-jira.js';
import {
  LinkedJiraIssuesEmpty,
  LinkedJiraIssuesError,
  LinkedJiraIssuesList,
  LinkedJiraIssuesSectionShell,
  LinkedJiraIssuesSkeleton,
} from './workflow-side-panel-linked-jira.js';

interface LinkedJiraIssuesSectionProps {
  runId: string;
}

export function LinkedJiraIssuesSection({ runId }: LinkedJiraIssuesSectionProps) {
  const { showSection, isLoading, isError, issues, handleRetry } = useSidePanelLinkedJira(runId);

  if (!showSection) return null;

  let body: React.ReactNode;
  if (isError) {
    body = <LinkedJiraIssuesError onRetry={handleRetry} />;
  } else if (isLoading) {
    body = <LinkedJiraIssuesSkeleton />;
  } else if (issues.length === 0) {
    body = <LinkedJiraIssuesEmpty />;
  } else {
    body = <LinkedJiraIssuesList issues={issues} />;
  }

  return <LinkedJiraIssuesSectionShell>{body}</LinkedJiraIssuesSectionShell>;
}
