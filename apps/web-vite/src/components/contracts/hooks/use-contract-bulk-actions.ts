import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const contractPrefixKey = ['contract'] as const;

export interface ContractBulkActionsHandlers {
  onBulkTerminate: (ids: string[]) => void;
  isTerminating: boolean;
}

export function useContractBulkActions(count: number): ContractBulkActionsHandlers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tc = useTranslations('Contracts');

  const bulkTerminateMutation = useResourceMutation(
    trpc.contract.bulkTransition.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.contract.pathFilter());
      },
    }),
    {
      invalidate: [contractPrefixKey],
      successMessage: tc('terminated', { count }),
      errorMessage: tc('error.loadFailed'),
    },
  );

  const onBulkTerminate = useCallback(
    (ids: string[]) => {
      bulkTerminateMutation.mutate({
        ids,
        targetStatus: 'TERMINATED',
      });
    },
    [bulkTerminateMutation],
  );

  return {
    onBulkTerminate,
    isTerminating: bulkTerminateMutation.isPending,
  };
}
