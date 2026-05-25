import { useQuery } from '@tanstack/react-query';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useWorkflowsList() {
  const trpc = useTRPC();
  const { can } = usePermissions();

  const runsCountQuery = useQuery(trpc.workflow.listRuns.queryOptions({ page: 1, pageSize: 10 }));
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );

  const runsTotal = (runsCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = runsCountQuery.isLoading;
  const canManageTemplates = can('workflow', ['create']);

  const showEmptyState = !isCountLoading && runsTotal === 0 && !canManageTemplates;

  return {
    runsTotal,
    contractorCount,
    isCountLoading,
    canManageTemplates,
    showEmptyState,
  } as const;
}
