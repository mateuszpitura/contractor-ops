import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import type { TranslateFn } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type IntegrationProviderSectionConfig<TConnection> = {
  /** i18n namespace passed to useTranslations by the caller */
  t: TranslateFn;
  connection: TConnection | null | undefined;
  isLoading: boolean;
  /** Status values that mean "connected" for this provider */
  connectedStatuses?: readonly string[];
  /** Auto-open mapping dialog when connection is in this status */
  autoOpenMappingOnStatus?: string;
};

export type IntegrationProviderSectionState = {
  mappingDialogOpen: boolean;
  setMappingDialogOpen: (open: boolean) => void;
  openMappingDialog: () => void;
};

/**
 * Shared UI state for integration provider sections (Jira, Linear, KSeF, etc.).
 * Connection fetching stays provider-specific; this factory unifies dialog state.
 */
export function useIntegrationProviderSection<TConnection extends { status?: string }>(
  config: IntegrationProviderSectionConfig<TConnection>,
) {
  const { connection, isLoading, t, connectedStatuses = ['CONNECTED'], autoOpenMappingOnStatus } =
    config;
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

  const openMappingDialog = useCallback(() => {
    setMappingDialogOpen(true);
  }, []);

  const status = connection?.status;
  const isConnected = status != null && connectedStatuses.includes(status);
  const isPendingMapping = autoOpenMappingOnStatus != null && status === autoOpenMappingOnStatus;

  return {
    connection,
    isConnected,
    isPendingMapping,
    needsReauth: status === 'REAUTH_REQUIRED',
    mappingDialogOpen,
    setMappingDialogOpen,
    openMappingDialog,
    t,
    isLoading,
  } as const;
}

export type IntegrationHealthProvider =
  | 'google_workspace'
  | 'microsoft_teams'
  | 'linear'
  | 'jira';

export type DeprovisioningProvider = 'OKTA' | 'ENTRA' | 'GITHUB';

/**
 * Fetches `integration.getHealth` and delegates connection UI state to
 * `useIntegrationProviderSection`.
 */
export function useIntegrationHealthProviderSection(
  provider: IntegrationHealthProvider,
  t: TranslateFn,
  options?: {
    connectedStatuses?: readonly string[];
    autoOpenMappingOnStatus?: string;
  },
) {
  const trpc = useTRPC();
  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider }));

  const section = useIntegrationProviderSection({
    t,
    connection: healthQuery.data,
    isLoading: healthQuery.isLoading,
    connectedStatuses: options?.connectedStatuses ?? ['CONNECTED'],
    autoOpenMappingOnStatus: options?.autoOpenMappingOnStatus,
  });

  return {
    ...section,
    isError: healthQuery.isError,
    onRetry: () => healthQuery.refetch(),
    scopeCapabilities: healthQuery.data?.scopeCapabilities ?? null,
  } as const;
}

/**
 * Shared deprovisioning toggle section for Okta / Entra / GitHub IDP providers.
 */
export function useDeprovisioningProviderSection(
  provider: DeprovisioningProvider,
  t: TranslateFn,
) {
  const trpc = useTRPC();
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();

  const stateQuery = useQuery(trpc.deprovisioning.getProviderToggleState.queryOptions());
  const providerRow = stateQuery.data?.providers.find(p => p.provider === provider);

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
      mutation.mutate({ provider, enabled });
    },
    [mutation, provider],
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
