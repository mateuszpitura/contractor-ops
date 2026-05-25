import { useWorkflowNavBadge } from './hooks/use-workflow-nav-badge.js';
import { WorkflowNavBadge } from './workflow-nav-badge.js';

export function WorkflowNavBadgeContainer() {
  const badge = useWorkflowNavBadge();
  return <WorkflowNavBadge {...badge} />;
}
