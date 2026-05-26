import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDownloadZugferdPdf(invoiceId: string) {
  const t = useTranslations('EInvoice.intake');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const generateMutation = useMutation(
    trpc.einvoice.generateZugferdPdf.mutationOptions({
      onSuccess: result => {
        const signedUrl = (result as { signedUrl?: string } | undefined)?.signedUrl;
        if (!signedUrl) {
          toast.error(t('genFailureToast'));
          return;
        }
        const anchor = document.createElement('a');
        anchor.href = signedUrl;
        anchor.download = `invoice-${invoiceId}-zugferd.pdf`;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.success(t('genSuccessToast'));
        void queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: invoiceId }),
        });
      },
      onError: () => {
        toast.error(t('genFailureToast'));
      },
    }),
  );

  const onDownload = useCallback(() => {
    generateMutation.mutate({ invoiceId });
  }, [generateMutation, invoiceId]);

  return {
    onDownload,
    isPending: generateMutation.isPending,
  } as const;
}
