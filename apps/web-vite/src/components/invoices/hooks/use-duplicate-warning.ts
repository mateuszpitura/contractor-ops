import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDuplicateWarning(invoiceId: string, onDismiss?: () => void) {
  const t = useTranslations('Invoices');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const dismissMutation = useMutation(
    trpc.invoice.dismissDuplicate.mutationOptions({
      onSuccess: () => {
        toast.success(t('duplicate.dismissedToast'));
        onDismiss?.();
        queryClient.invalidateQueries(trpc.invoice.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  const handleDismiss = useCallback(() => {
    dismissMutation.mutate({ id: invoiceId });
  }, [dismissMutation, invoiceId]);

  return {
    isPending: dismissMutation.isPending,
    onDismiss: handleDismiss,
  } as const;
}
