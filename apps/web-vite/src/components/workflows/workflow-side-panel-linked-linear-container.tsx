import { useSidePanelLinkedLinear } from './hooks/use-side-panel-linked-linear.js';
import { LinkedLinearIssuesView } from './workflow-side-panel-linked-linear.js';

interface LinkedLinearIssuesSectionProps {
  runId: string;
}

export function LinkedLinearIssuesSection({ runId }: LinkedLinearIssuesSectionProps) {
  const props = useSidePanelLinkedLinear(runId);
  return <LinkedLinearIssuesView {...props} />;
}
