import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLateInterestRevokeWaiverDialog(
  invoiceId: string,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('Payments.lateInterest.revokeWaiver');
  const trpc = useTRPC();

  const revokeMutation = useResourceMutation(
    trpc.latePaymentInterest.revokeWaiver.mutationOptions(),
    {
      invalidate: [trpc.latePaymentInterest.getForInvoice.queryKey({ invoiceId })],
      successMessage: t('successToast'),
      onClose: () => onOpenChange(false),
    },
  );

  return {
    onConfirm: (waiverId: string, revokeReason: string) => {
      revokeMutation.mutate({ waiverId, revokeReason: revokeReason.trim() });
    },
    isPending: revokeMutation.isPending,
  } as const;
}
