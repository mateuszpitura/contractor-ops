import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useRevalidateVat(contractorId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Contractors.revalidateVat');

  const mutation = useMutation(
    trpc.contractor.revalidateVat.mutationOptions({
      onSuccess: (result: { responseStatus: 'valid' | 'invalid' | 'stale' | 'unavailable' }) => {
        if (result.responseStatus === 'valid') {
          toast.success(t('successToast'));
        } else if (result.responseStatus === 'invalid') {
          toast.error(t('invalidToast'));
        } else {
          toast.warning(t('unavailableToast'));
        }
        void queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey({ id: contractorId }),
        });
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || t('errorToast'));
      },
    }),
  );

  const revalidate = useCallback(() => mutation.mutate({ contractorId }), [mutation, contractorId]);

  return { mutation, revalidate, isPending: mutation.isPending } as const;
}
