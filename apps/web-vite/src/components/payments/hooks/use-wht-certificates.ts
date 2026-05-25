import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useWhtCertificates() {
  const t = useTranslations('Payments.wht');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const generateMutation = useMutation(
    trpc.tax.generateWhtCertificate.mutationOptions({
      onSuccess: (data: { certificateNumber: string }) => {
        toast.success(t('certificateGenerated', { number: data.certificateNumber }));
        queryClient.invalidateQueries(trpc.tax.pathFilter());
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || t('certificateGenerationFailed'));
      },
    }),
  );

  const onGenerateAll = useCallback(
    (itemIds: string[]) => {
      for (const id of itemIds) {
        generateMutation.mutate({ paymentRunItemId: id });
      }
    },
    [generateMutation],
  );

  return {
    onGenerateAll,
    isGenerating: generateMutation.isPending,
  } as const;
}
