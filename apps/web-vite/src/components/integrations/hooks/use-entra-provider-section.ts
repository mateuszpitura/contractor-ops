/**
 * Phase 78 IDP-05 — sole tRPC boundary for the Microsoft Entra ID deprovisioning
 * provider section. Reads per-org Entra deprovisioning status (signoff approval +
 * enabled flag) and drives the enable toggle. The hybrid-AD hard-block + CA-policy
 * warning copy is informational here; the live preview/saga UI is Phase 76/77's
 * surface. This hook is the ONLY useTRPC/useQuery/useMutation boundary for the
 * section (Page→Container→Hook→Component, apps/web-vite/ARCHITECTURE.md).
 *
 * Routes through the unified `deprovisioning.getProviderToggleState` +
 * `deprovisioning.enableProviderForOrg` procedures (MED-1 consolidation) so the
 * per-provider router triplet is no longer needed.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const PROVIDER = 'ENTRA' as const;

export function useEntraProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.entra');
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
