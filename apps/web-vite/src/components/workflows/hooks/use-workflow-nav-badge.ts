import { useWorkflowOverdueCount } from './use-workflow-ui.js';

export function useWorkflowNavBadge() {
  const overdueQuery = useWorkflowOverdueCount();
  const count = (overdueQuery.data as { count: number } | undefined)?.count ?? 0;

  return { count } as const;
}
