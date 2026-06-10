import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLateInterestClaimDialog(
  invoiceId: string,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('Payments.lateInterest.claim');
  const trpc = useTRPC();

  const claimMutation = useResourceMutation(trpc.latePaymentInterest.claim.mutationOptions(), {
    invalidate: [trpc.latePaymentInterest.getForInvoice.queryKey({ invoiceId })],
    successMessage: t('successToast'),
    onClose: () => onOpenChange(false),
  });

  return {
    onConfirm: (issueAsSecondaryInvoice: boolean) => {
      claimMutation.mutate({ invoiceId, issueAsSecondaryInvoice });
    },
    isPending: claimMutation.isPending,
  } as const;
}
