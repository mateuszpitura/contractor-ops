import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type RecomputeReason = 'policy_version_bump' | 'classification_outcome_change' | 'admin_correction';

interface MutationResultEntry {
  contractorId: string;
  noop?: boolean;
  reason?: string;
  policyRuleSetVersionBefore?: string | null;
  waivedCount?: number;
  insertedCount?: number;
  carriedForwardCount?: number;
  error?: string;
}

interface MutationResultPayload {
  results: MutationResultEntry[];
}

export function useRecomputeCompliance(onSuccess?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Contractors.Compliance.Recompute');

  const mutation = useMutation(
    trpc.classification?.recreateComplianceAssessment.mutationOptions({
      onSuccess: (data: MutationResultPayload) => {
        const updated = data.results
          .filter(r => r.noop !== true && !r.error)
          .reduce((acc, r) => acc + (r.waivedCount ?? 0) + (r.insertedCount ?? 0), 0);
        const skipped = data.results.filter(r => r.noop === true).length;
        const errored = data.results.filter(r => r.error).length;

        if (errored > 0) {
          toast.warning(t('toast.partial', { updated, skipped, errored }));
        } else if (skipped > 0) {
          toast.success(t('toast.successWithSkipped', { updated, skipped }));
        } else {
          toast.success(t('toast.success', { updated }));
        }
        queryClient.invalidateQueries(trpc.classification?.pathFilter());
        onSuccess?.();
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || t('toast.error'));
      },
    }),
  );

  const recompute = useCallback(
    (contractorIds: string[], reason: RecomputeReason) => {
      mutation.mutate({ contractorIds, reason });
    },
    [mutation],
  );

  return { mutation, recompute, isPending: mutation.isPending } as const;
}
