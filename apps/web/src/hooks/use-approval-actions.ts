import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/trpc/init';

/**
 * Encapsulates approval queue action mutations (approve, reject, delegate,
 * request clarification) with their UI state.
 */
export function useApprovalActions(
  stepId: string,
  onSuccess: () => void,
): {
  approve: () => void;
  reject: (comment: string) => void;
  delegate: (userId: string, comment: string) => void;
  requestClarification: (comment: string) => void;
  isPending: boolean;
} {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['approval', 'listPending']],
    });
  }, [queryClient]);

  const approveMutation = useMutation(
    trpc.approval.approve.mutationOptions({
      onSuccess: () => {
        toast.success('Approved');
        invalidate();
        onSuccess();
      },
      onError: () => {
        toast.error('Failed to approve');
      },
    }),
  );

  const rejectMutation = useMutation(
    trpc.approval.reject.mutationOptions({
      onSuccess: () => {
        toast.success('Rejected');
        invalidate();
        onSuccess();
      },
      onError: () => {
        toast.error('Failed to reject');
      },
    }),
  );

  const clarifyMutation = useMutation(
    trpc.approval.requestClarification.mutationOptions({
      onSuccess: () => {
        toast.success('Clarification requested');
        invalidate();
        onSuccess();
      },
      onError: () => {
        toast.error('Failed to request clarification');
      },
    }),
  );

  const delegateMutation = useMutation(
    trpc.approval.delegate.mutationOptions({
      onSuccess: () => {
        toast.success('Delegated');
        invalidate();
        onSuccess();
      },
      onError: () => {
        toast.error('Failed to delegate');
      },
    }),
  );

  const approve = useCallback(() => {
    approveMutation.mutate({ stepId } as Parameters<typeof approveMutation.mutate>[0]);
  }, [approveMutation, stepId]);

  const reject = useCallback(
    (comment: string) => {
      rejectMutation.mutate({ stepId, comment } as Parameters<typeof rejectMutation.mutate>[0]);
    },
    [rejectMutation, stepId],
  );

  const delegate = useCallback(
    (userId: string, comment: string) => {
      delegateMutation.mutate({ stepId, targetUserId: userId, note: comment } as Parameters<
        typeof delegateMutation.mutate
      >[0]);
    },
    [delegateMutation, stepId],
  );

  const requestClarification = useCallback(
    (comment: string) => {
      clarifyMutation.mutate({ stepId, comment } as Parameters<typeof clarifyMutation.mutate>[0]);
    },
    [clarifyMutation, stepId],
  );

  const isPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    clarifyMutation.isPending ||
    delegateMutation.isPending;

  return { approve, reject, delegate, requestClarification, isPending };
}
