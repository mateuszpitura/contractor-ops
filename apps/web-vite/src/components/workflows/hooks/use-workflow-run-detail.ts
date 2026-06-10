import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { authClient } from '../../../lib/auth-client.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useWorkflowRunDetail(runId: string) {
  const trpc = useTRPC();
  const session = authClient().useSession();
  const currentUserId = session?.data?.user?.id ?? null;

  const {
    query: runQuery,
    data: run,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } = useEntityDetailQuery(trpc.workflow.getRun.queryOptions({ id: runId }));

  useBreadcrumbOverride(runId, run?.workflowTemplate?.name);

  return {
    run,
    runQuery,
    currentUserId,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } as const;
}
