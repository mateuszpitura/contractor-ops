import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useContractorProfileActions(contractorId: string, stage: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('ContractorProfile');
  const tToast = useTranslations('ContractorProfile.toast');
  const toasts = useCommonToasts();

  const contractorPrefixKey = ['contractor'] as const;

  const lifecycleMutation = useResourceMutation(
    trpc.contractor.updateLifecycleStage.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(toasts.done());
        queryClient.invalidateQueries(trpc.contractor.pathFilter());
      },
    }),
    {
      invalidate: [contractorPrefixKey, trpc.contractor.getById.queryKey()],
      successMessage: t('lifecycle.transitioned', { stage }),
      errorMessage: tToast('statusFailed'),
    },
  );

  const archiveMutation = useResourceMutation(
    trpc.contractor.archive.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(toasts.done());
        queryClient.invalidateQueries(trpc.contractor.pathFilter());
      },
    }),
    {
      invalidate: [contractorPrefixKey, trpc.contractor.getById.queryKey()],
      successMessage: t('lifecycle.archived'),
      errorMessage: tToast('archiveFailed'),
    },
  );

  const transitionLifecycle = useCallback(
    (target: 'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'ENDED') => {
      lifecycleMutation.mutate({ id: contractorId, stage: target });
    },
    [contractorId, lifecycleMutation],
  );

  const archive = useCallback(() => {
    archiveMutation.mutate({ id: contractorId });
  }, [archiveMutation, contractorId]);

  return {
    lifecycleMutation,
    archiveMutation,
    transitionLifecycle,
    archive,
    isPending: lifecycleMutation.isPending || archiveMutation.isPending,
  } as const;
}

export function useContractorNotes(contractorId: string, initialNotes: string | null) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('ContractorProfile.rightRail');
  const tToast = useTranslations('ContractorProfile.toast');

  const [notes, setNotes] = useState(initialNotes ?? '');
  const [isDirty, setIsDirty] = useState(false);

  const noteSaveMutation = useMutation(
    trpc.contractor.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('saved'));
        setIsDirty(false);
        queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey(),
        });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('noteFailed'));
      },
    }),
  );

  const updateNotes = useCallback((value: string) => {
    setNotes(value);
    setIsDirty(true);
  }, []);

  const saveNotes = useCallback(() => {
    noteSaveMutation.mutate({ id: contractorId, notes });
  }, [contractorId, noteSaveMutation, notes]);

  return {
    notes,
    isDirty,
    updateNotes,
    saveNotes,
    noteSaveMutation,
  } as const;
}
