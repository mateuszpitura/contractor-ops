import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export type RejectReasonCategory =
  | 'wrong_document_type'
  | 'illegible'
  | 'already_expired'
  | 'forged_or_altered'
  | 'other';

export const REJECT_REASON_CATEGORIES: readonly RejectReasonCategory[] = [
  'wrong_document_type',
  'illegible',
  'already_expired',
  'forged_or_altered',
  'other',
];

/**
 * Phase 73 D-08 — the only tRPC boundary for the admin upload-review dialog.
 * Wraps approve + reject mutations with toasts + compliance-query invalidation.
 */
export function useUploadReview(onSettled?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Compliance.uploadReview');

  const invalidate = () => queryClient.invalidateQueries(trpc.classification.pathFilter());

  const approveMutation = useMutation(
    trpc.classification.approveUploadReplacement.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        void invalidate();
        onSettled?.();
      },
      onError: err => toast.error(err.message || t('toast.error')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.classification.rejectUploadReplacement.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        void invalidate();
        onSettled?.();
      },
      onError: err => toast.error(err.message || t('toast.error')),
    }),
  );

  return {
    approve: (input: { itemId: string; documentId: string; expiresAt: string }) =>
      approveMutation.mutate(input),
    reject: (input: {
      itemId: string;
      documentId: string;
      reasonCategory: RejectReasonCategory;
      freeText?: string;
    }) => rejectMutation.mutate(input),
    isPending: approveMutation.isPending || rejectMutation.isPending,
  } as const;
}
