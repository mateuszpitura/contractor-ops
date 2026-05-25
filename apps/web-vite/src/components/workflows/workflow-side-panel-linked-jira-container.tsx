import { useSidePanelLinkedJira } from './hooks/use-side-panel-linked-jira.js';
import { LinkedJiraIssuesView } from './workflow-side-panel-linked-jira.js';

interface LinkedJiraIssuesSectionProps {
  runId: string;
}

export function LinkedJiraIssuesSection({ runId }: LinkedJiraIssuesSectionProps) {
  const props = useSidePanelLinkedJira(runId);
  return <LinkedJiraIssuesView {...props} />;
}
