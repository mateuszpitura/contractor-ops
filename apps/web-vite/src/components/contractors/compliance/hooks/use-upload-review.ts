import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../../i18n/use-translated-error.js';
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
 * The only tRPC boundary for the admin upload-review dialog.
 * Wraps approve + reject mutations with toasts + compliance-query invalidation.
 */
export function useUploadReview(onSettled?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Compliance.uploadReview');
  const translateError = useTranslatedError();

  const invalidate = () => queryClient.invalidateQueries(trpc.complianceAdmin.pathFilter());

  const approveMutation = useMutation(
    trpc.complianceAdmin.approveUploadReplacement.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        void invalidate();
        onSettled?.();
      },
      onError: (err: unknown) => toast.error(translateError(err)),
    }),
  );

  const rejectMutation = useMutation(
    trpc.complianceAdmin.rejectUploadReplacement.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        void invalidate();
        onSettled?.();
      },
      onError: (err: unknown) => toast.error(translateError(err)),
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
