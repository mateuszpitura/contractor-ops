import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

/**
 * tRPC/React Query boundary for the contract health-check panel — exposes the
 * re-run mutation. The panel itself is presentational; this hook feeds it
 * `onRerun` / `isRerunning`.
 */
export function useHealthCheckPanel(contractId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('ContractDetail.healthCheck');

  const rerun = useMutation(
    trpc.contract.rerunHealthCheck.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey({ id: contractId }),
        });
      },
      onError: () => toast.error(t('errors.failedToRerun')),
    }),
  );

  const onRerun = useCallback(() => {
    rerun.mutate({ contractIds: [contractId] });
  }, [rerun, contractId]);

  return { onRerun, isRerunning: rerun.isPending } as const;
}
