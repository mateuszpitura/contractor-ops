import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLateInterestClaimDialog(
  invoiceId: string,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('Payments.lateInterest.claim');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const claimMutation = useMutation(
    trpc.latePaymentInterest.claim.mutationOptions({
      onSuccess: () => {
        toast.success(t('successToast'));
        void queryClient.invalidateQueries({
          queryKey: trpc.latePaymentInterest.getForInvoice.queryKey({ invoiceId }),
        });
        onOpenChange(false);
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  return {
    onConfirm: (issueAsSecondaryInvoice: boolean) => {
      claimMutation.mutate({ invoiceId, issueAsSecondaryInvoice });
    },
    isPending: claimMutation.isPending,
  } as const;
}
