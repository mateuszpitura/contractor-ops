import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface BoeRateEntry {
  id: string;
  effectiveFrom: string | Date;
  ratePercent: number | string;
  source: string;
  notes?: string | null;
  recordedByUserId?: string | null;
  recordedAt: string | Date;
  createdAt: string | Date;
}

export function useBoeRateList() {
  const trpc = useTRPC();
  const listQuery = useQuery(trpc.adminBoeRate.list.queryOptions());
  const entries = listQuery.data as BoeRateEntry[] | undefined;

  return {
    entries,
    isLoading: listQuery.isLoading,
  } as const;
}

export function useBoeRatePollerStatus() {
  const { entries } = useBoeRateList();
  const apiEntries = entries?.filter(e => e.source === 'BOE_API') ?? [];
  const latestApiEntry = apiEntries[0] ?? null;
  const previousApiEntry = apiEntries.length > 1 ? apiEntries[1] : null;
  const rateChanged =
    latestApiEntry && previousApiEntry
      ? Number(latestApiEntry.ratePercent) !== Number(previousApiEntry.ratePercent)
      : true;

  return {
    entries,
    apiEntries,
    latestApiEntry,
    rateChanged,
  } as const;
}

export function useBoeRateInsert(onSuccess: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Admin.BoeRate');
  const translateError = useTranslatedError();

  return useMutation(
    trpc.adminBoeRate.insert.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.adminBoeRate.list.queryKey(),
        });
        toast.success(t('toastRateAdded'), {
          description: t('toastRateAddedDesc'),
        });
        onSuccess();
      },
      onError: error => {
        toast.error(t('toastError'), { description: translateError(error) });
      },
    }),
  );
}

export function useBoeRateUpdate(onSuccess: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Admin.BoeRate');
  const translateError = useTranslatedError();

  return useMutation(
    trpc.adminBoeRate.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.adminBoeRate.list.queryKey(),
        });
        toast.success(t('toastRateUpdated'), {
          description: t('toastRateUpdatedDesc'),
        });
        onSuccess();
      },
      onError: error => {
        toast.error(t('toastError'), { description: translateError(error) });
      },
    }),
  );
}

export function useBoeRateDelete(onSuccess: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Admin.BoeRate');
  const translateError = useTranslatedError();

  return useMutation(
    trpc.adminBoeRate.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.adminBoeRate.list.queryKey(),
        });
        toast.success(t('toastRateDeleted'), {
          description: t('toastRateDeletedDesc'),
        });
        onSuccess();
      },
      onError: error => {
        toast.error(t('toastError'), { description: translateError(error) });
      },
    }),
  );
}

export function useBoeRateValidation() {
  const t = useTranslations('Admin.BoeRate');

  const validateRate = useCallback(
    (ratePercent: string) => {
      const rate = parseFloat(ratePercent);
      if (Number.isNaN(rate) || rate < 0 || rate > 99.99) {
        toast.error(t('toastValidationError'), {
          description: t('validationRateRange'),
        });
        return null;
      }
      return rate;
    },
    [t],
  );

  const validateDate = useCallback(
    (effectiveFrom: string) => {
      if (!effectiveFrom) {
        toast.error(t('toastValidationError'), {
          description: t('validationDateRequired'),
        });
        return false;
      }
      return true;
    },
    [t],
  );

  return { validateRate, validateDate } as const;
}
