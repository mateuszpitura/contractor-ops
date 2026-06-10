/**
 * Approval queue actions hook.
 */

import type { AppRouter } from '@contractor-ops/api';
import type { inferRouterInputs } from '@trpc/server';
import { useCallback } from 'react';

import { COMMON_TOAST } from '../i18n/common-toast-keys.js';
import { useTRPC } from '../providers/trpc-provider.js';
import { useResourceMutation } from './use-resource-mutation.js';

type ApprovalInputs = inferRouterInputs<AppRouter>['approval'];

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
      successMessage: COMMON_TOAST.approved,
      errorMessage: COMMON_TOAST.failedToApprove,
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
      successMessage: COMMON_TOAST.rejected,
      errorMessage: COMMON_TOAST.failedToReject,
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
      successMessage: COMMON_TOAST.clarificationRequested,
      errorMessage: COMMON_TOAST.failedToRequestClarification,
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
      successMessage: COMMON_TOAST.delegated,
      errorMessage: COMMON_TOAST.failedToDelegate,
    },
  );

  const approve = useCallback(() => {
    const input: ApprovalInputs['approve'] = { stepId };
    approveMutation.mutate(input);
  }, [approveMutation, stepId]);

  const reject = useCallback(
    (comment: string) => {
      const input: ApprovalInputs['reject'] = { stepId, comment };
      rejectMutation.mutate(input);
    },
    [rejectMutation, stepId],
  );

  const delegate = useCallback(
    (userId: string, comment: string) => {
      const input: ApprovalInputs['delegate'] = { stepId, delegateToUserId: userId, comment };
      delegateMutation.mutate(input);
    },
    [delegateMutation, stepId],
  );

  const requestClarification = useCallback(
    (comment: string) => {
      const input: ApprovalInputs['requestClarification'] = { stepId, comment };
      clarifyMutation.mutate(input);
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
