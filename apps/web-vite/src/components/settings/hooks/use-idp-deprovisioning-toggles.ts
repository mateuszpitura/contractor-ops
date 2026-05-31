/**
 * Phase 77 D-15 — sole tRPC boundary for the per-provider IdP-deprovisioning
 * enable table. Reads org settings + per-provider signoff/connection state and
 * drives the enableProviderForOrg mutation. A provider row is only enableable
 * when its signoff flag is APPROVED; GWS and Slack toggle independently.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

// Phase 78 D-12 — widened to the five Deprovisionable providers. The server's
// getProviderToggleState now returns ENTRA/OKTA/GITHUB alongside GWS/Slack; the
// full per-provider UI (labels, cards) is built in 78-07.
export type ToggleProvider = 'GOOGLE_WORKSPACE' | 'SLACK' | 'ENTRA' | 'OKTA' | 'GITHUB';

export interface ProviderToggleRow {
  provider: ToggleProvider;
  connected: boolean;
  flagApproved: boolean;
  enabled: boolean;
  /** Toggle is disabled unless the provider's signoff flag is APPROVED. */
  toggleDisabled: boolean;
}

export function useIdpDeprovisioningToggles() {
  const trpc = useTRPC();
  const t = useTranslations('Idp.toggleTable');
  const queryClient = useQueryClient();

  const stateQuery = useQuery(trpc.deprovisioning.getProviderToggleState.queryOptions());

  const mutation = useMutation(
    trpc.deprovisioning.enableProviderForOrg.mutationOptions({
      onSuccess: () => {
        toast.success(t('toggleSuccess'));
        queryClient.invalidateQueries({
          queryKey: trpc.deprovisioning.getProviderToggleState.queryKey(),
        });
      },
      onError: err => toast.error(err.message || t('toggleFailure')),
    }),
  );

  const rows: ProviderToggleRow[] = (stateQuery.data?.providers ?? []).map(p => ({
    provider: p.provider,
    connected: p.connected,
    flagApproved: p.flagApproved,
    enabled: p.enabled,
    toggleDisabled: !p.flagApproved,
  }));

  const onToggle = useCallback(
    (provider: ToggleProvider, enabled: boolean) => {
      mutation.mutate({ provider, enabled });
    },
    [mutation],
  );

  return {
    isLoading: stateQuery.isLoading,
    isError: stateQuery.isError,
    onRetry: () => stateQuery.refetch(),
    rows,
    isEmpty: !(stateQuery.isLoading || stateQuery.isError) && rows.length === 0,
    onToggle,
    pendingProvider: mutation.isPending ? mutation.variables?.provider : undefined,
  } as const;
}
