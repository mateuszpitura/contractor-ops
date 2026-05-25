import { useWorkflowNavBadge } from './hooks/use-workflow-nav-badge.js';
import { WorkflowNavBadge } from './workflow-nav-badge.js';

export function WorkflowNavBadgeContainer() {
  const { count } = useWorkflowNavBadge();
  if (count === 0) return null;
  return <WorkflowNavBadge count={count} />;
}
