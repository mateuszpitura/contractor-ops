import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLegalPrivacyPdfDownload() {
  const t = useTranslations('Legal.privacy');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.legal.generatePrivacyNoticePdf.mutationOptions({
      onSuccess: () => {
        toast.success(t('exportQueued'));
        queryClient.invalidateQueries(trpc.legal.pathFilter());
      },
      onError: error => {
        const message = error instanceof Error ? error.message : t('pdfError');
        toast.error(message);
      },
    }),
  );

  return { mutation, isPending: mutation.isPending } as const;
}
