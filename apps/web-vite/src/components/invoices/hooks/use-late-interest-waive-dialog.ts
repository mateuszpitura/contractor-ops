import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLateInterestWaiveDialog(
  invoiceId: string,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('Payments.lateInterest.waive');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const waiveMutation = useMutation(
    trpc.latePaymentInterest.waive.mutationOptions({
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
    onConfirm: (waiveType: 'STATUTORY_INTEREST' | 'COMPENSATION' | 'BOTH', reason: string) => {
      waiveMutation.mutate({ invoiceId, waiveType, reason: reason.trim() });
    },
    isPending: waiveMutation.isPending,
  } as const;
}
