import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export type OverrideReasonCategory =
  | 'CONTRACTOR_OFFBOARDED'
  | 'ENGAGEMENT_CHANGED'
  | 'REGULATORY_EXEMPTION'
  | 'TEMPORARY_GRACE_PERIOD'
  | 'ADMIN_CORRECTION'
  | 'OTHER';

export const OVERRIDE_REASON_CATEGORIES: readonly OverrideReasonCategory[] = [
  'CONTRACTOR_OFFBOARDED',
  'ENGAGEMENT_CHANGED',
  'REGULATORY_EXEMPTION',
  'TEMPORARY_GRACE_PERIOD',
  'ADMIN_CORRECTION',
  'OTHER',
];

/**
 * Phase 73 D-12 — the only tRPC boundary for the manual override modal. Calls
 * the Plan 73-03 overrideItem mutation, toasts, and invalidates the compliance
 * query so the row reflects the new WAIVED state.
 */
export function useOverrideComplianceItem(onSuccess?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Compliance.override');

  const mutation = useMutation(
    trpc.classification.overrideItem.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.success'));
        void queryClient.invalidateQueries(trpc.classification.pathFilter());
        onSuccess?.();
      },
      onError: err => toast.error(err.message || t('toast.error')),
    }),
  );

  return {
    override: (input: {
      itemId: string;
      reasonCategory: OverrideReasonCategory;
      reasonNote: string;
    }) => mutation.mutate(input),
    isPending: mutation.isPending,
  } as const;
}
