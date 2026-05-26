import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseProviderConnectionCardOptions {
  provider: string;
  displayName: string;
  onDisconnected?: () => void;
}

export function useProviderConnectionCard({
  provider,
  displayName,
  onDisconnected,
}: UseProviderConnectionCardOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations');
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider }, { refetchInterval: 30000 }),
  );
  const health = healthQuery.data;

  useEffect(() => {
    const param = searchParams.get(provider);
    if (param === 'connected') {
      toast.success(t('providerToasts.connected', { provider: displayName }));
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getHealth.queryKey({ provider }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getAllHealth.queryKey(),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete(provider);
      window.history.replaceState({}, '', url.toString());
    } else if (param === 'error') {
      toast.error(t('providerToasts.connectFailed', { provider: displayName }));
      const url = new URL(window.location.href);
      url.searchParams.delete(provider);
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, provider, displayName, t, queryClient, trpc.integration]);

  const onDisconnectSuccess = () => {
    toast.success(t('providerToasts.disconnected', { provider: displayName }));
    queryClient.invalidateQueries({
      queryKey: trpc.integration.getHealth.queryKey({ provider }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.integration.getAllHealth.queryKey(),
    });
    onDisconnected?.();
  };
  const onDisconnectError = () => {
    toast.error(t('providerToasts.disconnectFailed', { provider: displayName }));
  };

  const genericDisconnect = useMutation(
    trpc.integration.disconnectGeneric.mutationOptions({
      onSuccess: onDisconnectSuccess,
      onError: onDisconnectError,
    }),
  );
  const jiraDisconnect = useMutation(
    trpc.jira.disconnect.mutationOptions({
      onSuccess: onDisconnectSuccess,
      onError: onDisconnectError,
    }),
  );
  const ksefDisconnect = useMutation(
    trpc.ksef.disconnect.mutationOptions({
      onSuccess: onDisconnectSuccess,
      onError: onDisconnectError,
    }),
  );

  const disconnectMutation =
    provider === 'jira' ? jiraDisconnect : provider === 'ksef' ? ksefDisconnect : genericDisconnect;

  const oauthUrlQuery = useQuery({
    ...trpc.integration.getOAuthUrlGeneric.queryOptions({ provider }),
    enabled: false,
  });

  async function handleConnect() {
    const result = await oauthUrlQuery.refetch();
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  }

  const handleDisconnectConfirm = () => {
    if (provider === 'jira') {
      if (!health?.connectionId) return;
      jiraDisconnect.mutate({ connectionId: health.connectionId });
    } else if (provider === 'ksef') {
      ksefDisconnect.mutate();
    } else {
      genericDisconnect.mutate({ provider });
    }
  };

  return {
    t,
    isLoading: healthQuery.isLoading,
    health,
    handleConnect,
    handleDisconnectConfirm,
    isDisconnectPending: disconnectMutation.isPending,
    jiraDisconnect,
    ksefDisconnect,
    genericDisconnect,
  } as const;
}
