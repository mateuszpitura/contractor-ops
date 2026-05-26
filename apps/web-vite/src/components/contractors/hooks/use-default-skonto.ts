import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDefaultSkonto(_billingProfileId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Payments.skonto.billingProfile');

  const upsertMutation = useMutation(
    trpc.skonto.upsertForBillingProfile.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        void queryClient.invalidateQueries(trpc.skonto.pathFilter());
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.skonto.deleteForBillingProfile.mutationOptions({
      onSuccess: () => {
        toast.success(t('deletedToast'));
        void queryClient.invalidateQueries(trpc.skonto.pathFilter());
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  return {
    upsertMutation,
    deleteMutation,
    upsert: upsertMutation.mutate,
    remove: deleteMutation.mutate,
    isPending: upsertMutation.isPending || deleteMutation.isPending,
  } as const;
}
