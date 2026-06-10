import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLateInterestWaiveDialog(
  invoiceId: string,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('Payments.lateInterest.waive');
  const trpc = useTRPC();

  const waiveMutation = useResourceMutation(trpc.latePaymentInterest.waive.mutationOptions(), {
    invalidate: [trpc.latePaymentInterest.getForInvoice.queryKey({ invoiceId })],
    successMessage: t('successToast'),
    onClose: () => onOpenChange(false),
  });

  return {
    onConfirm: (waiveType: 'STATUTORY_INTEREST' | 'COMPENSATION' | 'BOTH', reason: string) => {
      waiveMutation.mutate({ invoiceId, waiveType, reason: reason.trim() });
    },
    isPending: waiveMutation.isPending,
  } as const;
}
