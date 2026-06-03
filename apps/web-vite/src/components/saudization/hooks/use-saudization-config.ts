import type { AppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

export type SaudizationConfig = RouterOutputs['gulf']['saudization']['getConfig'];
export type UpsertConfigInput = RouterInputs['gulf']['saudization']['upsertConfig'];
export type UpsertHeadcountInput = RouterInputs['gulf']['saudization']['upsertHeadcount'];
export type NitaqatBand = NonNullable<UpsertConfigInput['band']>;

/**
 * The mutation boundary for the manual Saudization config (GULF-05/06) and the
 * GULF-10 drift overrides (GULF-10). The band is recorded by hand and sent verbatim —
 * there is NO derivation path (Pitfall 8). Every mutation invalidates the dashboard
 * query so the hero rate / neutral band / override badge re-render from server truth,
 * and toasts success/failure. tRPC stays inside this hook; the dialog + view are
 * presentational.
 */
export function useSaudizationConfig() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tToast = useTranslations('Saudization.toast');

  const configQuery = useQuery(trpc.gulf.saudization.getConfig.queryOptions());

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.gulf.saudization.dashboard.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.gulf.saudization.getConfig.queryKey() });
  }, [queryClient, trpc]);

  const upsertConfigMutation = useMutation(
    trpc.gulf.saudization.upsertConfig.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('bandSaved'));
        invalidate();
      },
      onError: () => toast.error(tToast('saveFailed')),
    }),
  );

  const upsertHeadcountMutation = useMutation(
    trpc.gulf.saudization.upsertHeadcount.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('headcountSaved'));
        invalidate();
      },
      onError: () => toast.error(tToast('saveFailed')),
    }),
  );

  const nitaqatOverrideMutation = useMutation(
    trpc.gulf.saudization.applyNitaqatThresholdOverride.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('overrideApplied'));
        invalidate();
      },
      onError: () => toast.error(tToast('saveFailed')),
    }),
  );

  const activityOverrideMutation = useMutation(
    trpc.gulf.saudization.applyPermittedActivityOverride.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('overrideApplied'));
        invalidate();
      },
      onError: () => toast.error(tToast('saveFailed')),
    }),
  );

  const saveBand = useCallback(
    (input: UpsertConfigInput) => upsertConfigMutation.mutate(input),
    [upsertConfigMutation],
  );

  const saveHeadcount = useCallback(
    (input: UpsertHeadcountInput) => upsertHeadcountMutation.mutate(input),
    [upsertHeadcountMutation],
  );

  const applyNitaqatOverride = useCallback(
    (custom: boolean) => nitaqatOverrideMutation.mutate({ custom }),
    [nitaqatOverrideMutation],
  );

  const applyActivityOverride = useCallback(
    (custom: boolean) => activityOverrideMutation.mutate({ custom }),
    [activityOverrideMutation],
  );

  return {
    config: configQuery.data ?? null,
    saveBand,
    isSavingBand: upsertConfigMutation.isPending,
    saveHeadcount,
    isSavingHeadcount: upsertHeadcountMutation.isPending,
    applyNitaqatOverride,
    isApplyingNitaqatOverride: nitaqatOverrideMutation.isPending,
    applyActivityOverride,
    isApplyingActivityOverride: activityOverrideMutation.isPending,
  } as const;
}
