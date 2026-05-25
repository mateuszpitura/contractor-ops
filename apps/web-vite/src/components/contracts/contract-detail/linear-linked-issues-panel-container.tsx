import { useLinearLinkedIssuesPanel } from '../hooks/use-linear-linked-issues-panel.js';
import { LinearLinkedIssuesPanel } from './linear-linked-issues-panel.js';

type LinearLinkedIssuesPanelContainerProps = {
  taskRunIds: string[];
  heading?: string;
  maxRows?: number;
};

export function LinearLinkedIssuesPanelContainer({
  taskRunIds,
  heading,
  maxRows,
}: LinearLinkedIssuesPanelContainerProps) {
  const panel = useLinearLinkedIssuesPanel(taskRunIds, maxRows);

  if (!panel.isVisible) return null;

  return (
    <LinearLinkedIssuesPanel heading={heading} isLoading={panel.isLoading} items={panel.items} />
  );
}
