import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export function useClassificationDisclaimerAck(assessmentId: string, onAcknowledged: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Classification');

  const ackMutation = useMutation(
    trpc.classification!.acknowledgeDisclaimer.mutationOptions({
      onSuccess: () => {
        onAcknowledged();
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.classification!.pathFilter());
      },
      onError: err => {
        toast.error(t('disclaimer.ackFailed'), { description: err.message });
      },
    }),
  );

  const acknowledge = useCallback(() => {
    ackMutation.mutate({ assessmentId });
  }, [ackMutation, assessmentId]);

  return { ackMutation, acknowledge, isPending: ackMutation.isPending } as const;
}
