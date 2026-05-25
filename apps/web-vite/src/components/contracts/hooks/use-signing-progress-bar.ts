import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSigningProgressBar(envelopeId: string) {
  const tToast = useTranslations('ContractDetail.signing.toast');
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const resendMutation = useMutation(
    trpc.esign.resendToRecipient.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(tToast('reminderSent', { email: variables.recipientEmail }));
        queryClient.invalidateQueries(trpc.esign.pathFilter());
      },
      onError: () => {
        toast.error(tToast('resendFailed'));
      },
    }),
  );

  const resendToRecipient = useCallback(
    (recipientEmail: string) => {
      resendMutation.mutate({ envelopeId, recipientEmail });
    },
    [envelopeId, resendMutation],
  );

  const invalidateAfterVoid = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.esign.listEnvelopes.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.contract.getById.queryKey(),
    });
  }, [queryClient, trpc.contract.getById, trpc.esign.listEnvelopes]);

  return {
    invalidateAfterVoid,
    isResendPending: resendMutation.isPending,
    resendToRecipient,
  } as const;
}
