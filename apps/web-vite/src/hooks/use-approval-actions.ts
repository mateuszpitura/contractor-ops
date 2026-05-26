/**
 * Approval queue actions hook. Step 11 codemod port from
 * apps/web/src/hooks/use-approval-actions.ts:
 *   - `@/trpc/init`  → `../providers/trpc-provider.js#useTRPC`
 *
 * Otherwise unchanged.
 */

import { useCallback } from 'react';

import { useTRPC } from '../providers/trpc-provider.js';
import { useResourceMutation } from './use-resource-mutation.js';

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
  const trpc = useTRPC();

  const approveMutation = useResourceMutation(
    trpc.approval.approve.mutationOptions({
      onSuccess: () => {
        onSuccess();
      },
    }),
    {
      invalidate: [[['approval', 'listPending']]],
      successMessage: 'Approved',
      errorMessage: 'Failed to approve',
    },
  );

  const rejectMutation = useResourceMutation(
    trpc.approval.reject.mutationOptions({
      onSuccess: () => {
        onSuccess();
      },
    }),
    {
      invalidate: [[['approval', 'listPending']]],
      successMessage: 'Rejected',
      errorMessage: 'Failed to reject',
    },
  );

  const clarifyMutation = useResourceMutation(
    trpc.approval.requestClarification.mutationOptions({
      onSuccess: () => {
        onSuccess();
      },
    }),
    {
      invalidate: [[['approval', 'listPending']]],
      successMessage: 'Clarification requested',
      errorMessage: 'Failed to request clarification',
    },
  );

  const delegateMutation = useResourceMutation(
    trpc.approval.delegate.mutationOptions({
      onSuccess: () => {
        onSuccess();
      },
    }),
    {
      invalidate: [[['approval', 'listPending']]],
      successMessage: 'Delegated',
      errorMessage: 'Failed to delegate',
    },
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
      delegateMutation.mutate({ stepId, delegateToUserId: userId, comment } as Parameters<
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
