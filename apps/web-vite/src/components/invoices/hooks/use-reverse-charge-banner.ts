import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useReverseChargeBanner(invoiceId: string, onToggle?: (newValue: boolean) => void) {
  const t = useTranslations('Invoices.reverseCharge');
  const trpc = useTRPC();

  const toggleMutation = useResourceMutation(
    trpc.invoice.toggleReverseCharge.mutationOptions({
      onSuccess: (_: unknown, vars: { isReverseCharge: boolean }) => {
        onToggle?.(vars.isReverseCharge);
      },
    }),
    {
      invalidate: [trpc.invoice.pathFilter()],
      successMessage: t('removedToast'),
    },
  );

  const handleRemove = useCallback(() => {
    toggleMutation.mutate({ invoiceId, isReverseCharge: false });
  }, [invoiceId, toggleMutation]);

  return {
    isPending: toggleMutation.isPending,
    onRemove: handleRemove,
  } as const;
}
