import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useVoidEnvelopeDialog(
  envelopeId: string,
  _open: boolean,
  onOpenChange: (open: boolean) => void,
  onVoided: () => void,
) {
  const t = useTranslations('ContractDetail.signing.voidDialog');
  const tToast = useTranslations('ContractDetail.signing.toast');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const voidMutation = useMutation(
    trpc.esign.voidEnvelope.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('voidSuccess'));
        onOpenChange(false);
        setReason('');
        onVoided();
        queryClient.invalidateQueries(trpc.esign.pathFilter());
      },
      onError: () => {
        toast.error(tToast('voidFailed'));
      },
    }),
  );

  const handleConfirm = useCallback(() => {
    voidMutation.mutate({
      envelopeId,
      reason: reason.trim() || t('defaultReason'),
    });
  }, [envelopeId, reason, t, voidMutation]);

  return {
    handleConfirm,
    isPending: voidMutation.isPending,
    reason,
    setReason,
  } as const;
}
