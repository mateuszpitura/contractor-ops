import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type MatchReason = 'VAT_ID' | 'LEITWEG_ID' | 'EXACT_NAME' | 'FUZZY_NAME' | string;

export interface IntakeMatchCandidate {
  contractorId: string;
  contractorName: string;
  contractorVatId?: string | null;
  matchReasons: Array<{ kind: MatchReason; distance?: number }>;
  score?: number;
}

export function useIntakeDetailMatch(
  intakeId: string,
  currentStatus: string,
  onSelectedCandidateChange?: (contractorId: string | null) => void,
) {
  const t = useTranslations('EInvoice.intake');
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const candidatesQuery = useQuery(
    trpc.invoiceIntake.getMatchCandidates.queryOptions({ intakeId }),
  );
  const candidates = (candidatesQuery.data as IntakeMatchCandidate[] | undefined) ?? [];

  useEffect(() => {
    if (candidates.length === 1 && !selectedId) {
      setSelectedId(candidates[0]?.contractorId ?? null);
    }
  }, [candidates, selectedId]);

  useEffect(() => {
    onSelectedCandidateChange?.(selectedId);
  }, [selectedId, onSelectedCandidateChange]);

  const confirmMutation = useMutation(
    trpc.invoiceIntake.confirmMatch.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.invoiceIntake.getById.queryKey({ intakeId }),
        });
        toast.success(toasts.done());
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const handleConfirm = (contractorId: string) => {
    setSelectedId(contractorId);
    confirmMutation.mutate({ intakeId, contractorId });
  };

  const handleCreateFromData = () => {
    router.push(`/contractors?createFromIntake=${intakeId}`);
  };

  const alreadyMatched = currentStatus === 'MATCHED' || currentStatus === 'CONVERTED';

  return {
    isLoading: candidatesQuery.isLoading,
    candidates,
    selectedId,
    setSelectedId,
    alreadyMatched,
    isConfirmPending: confirmMutation.isPending,
    onConfirm: handleConfirm,
    onCreateFromData: handleCreateFromData,
  } as const;
}
