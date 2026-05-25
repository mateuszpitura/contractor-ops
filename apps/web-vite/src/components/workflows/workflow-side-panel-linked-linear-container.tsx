import { useSidePanelLinkedLinear } from './hooks/use-side-panel-linked-linear.js';
import {
  LinkedLinearIssuesError,
  LinkedLinearIssuesList,
  LinkedLinearIssuesSectionShell,
  LinkedLinearIssuesSkeleton,
} from './workflow-side-panel-linked-linear.js';

interface LinkedLinearIssuesSectionProps {
  runId: string;
}

export function LinkedLinearIssuesSection({ runId }: LinkedLinearIssuesSectionProps) {
  const { showSection, isLoading, isError, issues, handleRetry } = useSidePanelLinkedLinear(runId);

  if (!showSection) return null;

  let body: React.ReactNode;
  if (isError) {
    body = <LinkedLinearIssuesError onRetry={handleRetry} />;
  } else if (isLoading) {
    body = <LinkedLinearIssuesSkeleton />;
  } else {
    body = <LinkedLinearIssuesList issues={issues} />;
  }

  return <LinkedLinearIssuesSectionShell>{body}</LinkedLinearIssuesSectionShell>;
}
