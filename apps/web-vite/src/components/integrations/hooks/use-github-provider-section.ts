/**
 * Phase 78 IDP-07 — sole tRPC boundary for the GitHub deprovisioning provider
 * section. Reads per-org GitHub deprovisioning status (signoff approval + enabled
 * flag) and drives the enable toggle. Only useTRPC/useQuery/useMutation boundary
 * for the section (Page→Container→Hook→Component).
 *
 * Routes through the unified `deprovisioning.getProviderToggleState` +
 * `deprovisioning.enableProviderForOrg` procedures (MED-1 consolidation).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const PROVIDER = 'GITHUB' as const;

export function useGitHubProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.github');
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();

  const stateQuery = useQuery(trpc.deprovisioning.getProviderToggleState.queryOptions());
  const providerRow = stateQuery.data?.providers.find(p => p.provider === PROVIDER);

  const mutation = useMutation(
    trpc.deprovisioning.enableProviderForOrg.mutationOptions({
      onSuccess: () => {
        toast.success(t('toggleSuccess'));
        queryClient.invalidateQueries({
          queryKey: trpc.deprovisioning.getProviderToggleState.queryKey(),
        });
      },
      onError: err => toast.error(translateError(err)),
    }),
  );

  const onToggle = useCallback(
    (enabled: boolean) => {
      mutation.mutate({ provider: PROVIDER, enabled });
    },
    [mutation],
  );

  return {
    isLoading: stateQuery.isLoading,
    isError: stateQuery.isError,
    onRetry: () => stateQuery.refetch(),
    flagApproved: providerRow?.flagApproved ?? false,
    enabled: providerRow?.enabled ?? false,
    isToggling: mutation.isPending,
    onToggle,
    t,
  } as const;
}
