import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useReverseChargeBanner(invoiceId: string, onToggle?: (newValue: boolean) => void) {
  const t = useTranslations('Invoices.reverseCharge');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation(
    trpc.invoice.toggleReverseCharge.mutationOptions({
      onSuccess: (_: unknown, vars: { isReverseCharge: boolean }) => {
        toast.success(vars.isReverseCharge ? t('applied') : t('removedToast'));
        onToggle?.(vars.isReverseCharge);
        queryClient.invalidateQueries(trpc.invoice.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  const handleRemove = useCallback(() => {
    toggleMutation.mutate({ invoiceId, isReverseCharge: false });
  }, [invoiceId, toggleMutation]);

  return {
    isPending: toggleMutation.isPending,
    onRemove: handleRemove,
  } as const;
}
