import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useApprovalQueueBulkActions(onClearSelection: () => void) {
  const t = useTranslations('Approvals');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['approval', 'listPending']],
    });
  }, [queryClient]);

  const bulkApproveMutation = useMutation(
    trpc.approval.bulkApprove.mutationOptions({
      onSuccess: data => {
        const result = data as { succeeded: number; failed: number };
        toast.success(t('toast.bulkApproved', { count: result.succeeded }));
        onClearSelection();
        invalidateList();
      },
      onError: () => {
        toast.error(t('errors.failedToApprove'));
      },
    }),
  );

  const bulkRejectMutation = useMutation(
    trpc.approval.bulkReject.mutationOptions({
      onSuccess: data => {
        const result = data as { succeeded: number; failed: number };
        toast.success(t('toast.bulkRejected', { count: result.succeeded }));
        onClearSelection();
        invalidateList();
      },
      onError: () => {
        toast.error(t('errors.failedToReject'));
      },
    }),
  );

  const onBulkApprove = useCallback(
    (stepIds: string[]) => {
      bulkApproveMutation.mutate({ stepIds });
    },
    [bulkApproveMutation],
  );

  const onBulkReject = useCallback(
    (stepIds: string[], comment: string) => {
      bulkRejectMutation.mutate({ stepIds, comment });
    },
    [bulkRejectMutation],
  );

  return {
    onBulkApprove,
    onBulkReject,
    isBulkApproving: bulkApproveMutation.isPending,
    isBulkRejecting: bulkRejectMutation.isPending,
  } as const;
}
