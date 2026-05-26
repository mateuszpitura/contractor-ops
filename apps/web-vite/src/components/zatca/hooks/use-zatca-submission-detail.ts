import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useZatcaSubmissionDetail(invoiceId: string) {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.submissionDetail');
  const queryClient = useQueryClient();

  const resubmitMutation = useMutation({
    ...zatcaTrpc.resubmit.mutationOptions(),
    onSuccess: () => {
      toast.success(t('toast.resubmitSuccess'));
      queryClient.invalidateQueries({
        queryKey: zatcaTrpc.getStatus.queryKey(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.resubmitError'));
    },
  });

  const resubmit = () => {
    (resubmitMutation.mutate as unknown as (input: { invoiceId: string }) => void)({
      invoiceId,
    });
  };

  return {
    resubmit,
    isResubmitPending: resubmitMutation.isPending,
    t,
  } as const;
}
