import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { authClient } from '../../../lib/auth-client.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useWorkflowRunDetail(runId: string) {
  const trpc = useTRPC();
  const session = authClient().useSession();
  const currentUserId = session?.data?.user?.id ?? null;

  const runQuery = useQuery(trpc.workflow.getRun.queryOptions({ id: runId }));
  const run = runQuery.data;

  useBreadcrumbOverride(runId, run?.workflowTemplate?.name);

  const handleRetry = useCallback(() => {
    void runQuery.refetch();
  }, [runQuery]);

  const isNotFound =
    runQuery.isError &&
    (runQuery.error?.message?.includes('not found') ||
      (runQuery.error as { data?: { code?: string } })?.data?.code === 'NOT_FOUND');

  return {
    run,
    runQuery,
    currentUserId,
    handleRetry,
    isNotFound,
    isLoading: runQuery.isLoading,
    isError: runQuery.isError,
  } as const;
}
