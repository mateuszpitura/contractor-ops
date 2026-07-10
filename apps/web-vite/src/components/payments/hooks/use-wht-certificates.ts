import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useWhtCertificates() {
  const t = useTranslations('Payments.wht');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const translateError = useTranslatedError();

  const generateMutation = useMutation(
    trpc.tax.generateWhtCertificate.mutationOptions({
      onSuccess: (data: { certificateNumber: string }) => {
        toast.success(t('certificateGenerated', { number: data.certificateNumber }));
        queryClient.invalidateQueries(trpc.tax.pathFilter());
      },
      onError: (err: unknown) => {
        toast.error(translateError(err));
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
