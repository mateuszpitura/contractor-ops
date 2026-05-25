import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useBacsSubmitterForm() {
  const t = useTranslations('Payments.bacs');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const masksQuery = useQuery(trpc.bacs.getSubmitterMasks.queryOptions());
  const masks = masksQuery.data;

  const saveMutation = useMutation(
    trpc.bacs.saveSubmitterConfig.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        void queryClient.invalidateQueries({
          queryKey: trpc.bacs.getSubmitterMasks.queryKey(),
        });
      },
      onError: err => {
        toast.error(err?.message ?? 'Failed to save BACS submitter details');
      },
    }),
  );

  return {
    masks,
    isMasksLoading: masksQuery.isLoading,
    onSave: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    submitterNameDefault: masks?.submitterName ?? '',
  } as const;
}

export function useBacsSubmitterNameSync(
  masksSubmitterName: string | undefined,
  isDirty: boolean,
  reset: (values: { submitterName: string }) => void,
) {
  useEffect(() => {
    if (masksSubmitterName && !isDirty) {
      reset({ submitterName: masksSubmitterName });
    }
  }, [masksSubmitterName, reset, isDirty]);
}
