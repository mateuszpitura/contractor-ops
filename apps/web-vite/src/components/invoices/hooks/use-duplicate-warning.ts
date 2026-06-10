import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDuplicateWarning(invoiceId: string, onDismiss?: () => void) {
  const t = useTranslations('Invoices');
  const trpc = useTRPC();

  const dismissMutation = useResourceMutation(
    trpc.invoice.dismissDuplicate.mutationOptions({
      onSuccess: () => {
        onDismiss?.();
      },
    }),
    {
      invalidate: [trpc.invoice.pathFilter()],
      successMessage: t('duplicate.dismissedToast'),
    },
  );

  const handleDismiss = useCallback(() => {
    dismissMutation.mutate({ id: invoiceId });
  }, [dismissMutation, invoiceId]);

  return {
    isPending: dismissMutation.isPending,
    onDismiss: handleDismiss,
  } as const;
}
