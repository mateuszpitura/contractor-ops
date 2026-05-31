import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface CredentialRow {
  id: string;
  label: string;
  vaultProvider: string;
  accessType: string;
  successorUserId: string | null;
  status: string;
}

/**
 * tRPC/React Query boundary for the offboarding Credentials tab.
 * Owns the list query + create/markRotated/remove mutations.
 */
export function useCredentialsTab(workflowRunId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const listQuery = useQuery(
    trpc.workflow.credentialReference.listByWorkflowRun.queryOptions({ workflowRunId }),
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.workflow.credentialReference.listByWorkflowRun.queryKey({ workflowRunId }),
    });
  }, [queryClient, trpc, workflowRunId]);

  const createMutation = useMutation(
    trpc.workflow.credentialReference.create.mutationOptions({
      onSuccess: () => {
        setAddDialogOpen(false);
        invalidate();
      },
    }),
  );

  const markRotatedMutation = useMutation(
    trpc.workflow.credentialReference.markRotated.mutationOptions({ onSuccess: invalidate }),
  );

  const removeMutation = useMutation(
    trpc.workflow.credentialReference.remove.mutationOptions({ onSuccess: invalidate }),
  );

  const rows = (listQuery.data ?? []) as CredentialRow[];

  return {
    rows,
    isLoading: listQuery.isPending,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
    addDialogOpen,
    setAddDialogOpen,
    createMutation,
    onMarkRotated: useCallback(
      (id: string) => markRotatedMutation.mutate({ id }),
      [markRotatedMutation],
    ),
    onRemove: useCallback((id: string) => removeMutation.mutate({ id }), [removeMutation]),
    isMutating: markRotatedMutation.isPending || removeMutation.isPending,
  } as const;
}
