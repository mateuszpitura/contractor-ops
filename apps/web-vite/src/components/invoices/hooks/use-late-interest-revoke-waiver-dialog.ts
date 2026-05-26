import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLateInterestRevokeWaiverDialog(
  invoiceId: string,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('Payments.lateInterest.revokeWaiver');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const revokeMutation = useMutation(
    trpc.latePaymentInterest.revokeWaiver.mutationOptions({
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
    onConfirm: (waiverId: string, revokeReason: string) => {
      revokeMutation.mutate({ waiverId, revokeReason: revokeReason.trim() });
    },
    isPending: revokeMutation.isPending,
  } as const;
}
