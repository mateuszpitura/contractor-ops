import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseProviderDetailSheetOptions {
  provider: string;
  displayName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnectDialogClose?: () => void;
}

export function useProviderDetailSheet({
  provider,
  displayName,
  open,
  onOpenChange,
  onDisconnectDialogClose,
}: UseProviderDetailSheetOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations');
  const queryClient = useQueryClient();

  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions(
      { provider },
      { refetchInterval: 30000, enabled: open },
    ),
  );
  const health = healthQuery.data;

  const [syncCursor, setSyncCursor] = useState<string | undefined>(undefined);
  const [allSyncItems, setAllSyncItems] = useState<
    Array<{
      id: string;
      syncType: string;
      status: string;
      direction: string;
      errorMessage: string | null;
      startedAt: Date | string;
      completedAt: Date | string | null;
    }>
  >([]);

  const syncLogQuery = useQuery({
    ...trpc.integration.getSyncLog.queryOptions({
      provider,
      limit: 10,
      cursor: syncCursor,
    }),
    enabled: open,
  });

  const syncItems =
    syncCursor && allSyncItems.length > 0
      ? [...allSyncItems, ...(syncLogQuery.data?.items ?? [])]
      : (syncLogQuery.data?.items ?? []);

  const handleLoadMoreSync = () => {
    if (syncLogQuery.data?.nextCursor) {
      setAllSyncItems(syncItems);
      setSyncCursor(syncLogQuery.data.nextCursor);
    }
  };

  const [webhookCursor, setWebhookCursor] = useState<string | undefined>(undefined);
  const [allWebhookItems, setAllWebhookItems] = useState<
    Array<{
      id: string;
      eventType: string;
      deliveryStatus: string;
      receivedAt: Date | string;
      processedAt: Date | string | null;
      errorMessage: string | null;
    }>
  >([]);

  const webhookLogQuery = useQuery({
    ...trpc.integration.getWebhookLog.queryOptions({
      provider,
      limit: 10,
      cursor: webhookCursor,
    }),
    enabled: open,
  });

  const webhookItems =
    webhookCursor && allWebhookItems.length > 0
      ? [...allWebhookItems, ...(webhookLogQuery.data?.items ?? [])]
      : (webhookLogQuery.data?.items ?? []);

  const handleLoadMoreWebhook = () => {
    if (webhookLogQuery.data?.nextCursor) {
      setAllWebhookItems(webhookItems);
      setWebhookCursor(webhookLogQuery.data.nextCursor);
    }
  };

  const oauthUrlQuery = useQuery({
    ...trpc.integration.getOAuthUrlGeneric.queryOptions({ provider }),
    enabled: false,
  });

  async function handleReauthorize() {
    const result = await oauthUrlQuery.refetch();
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  }

  const disconnectMutation = useMutation(
    trpc.integration.disconnectGeneric.mutationOptions({
      onSuccess: () => {
        toast.success(t('providerToasts.disconnected', { provider: displayName }));
        queryClient.invalidateQueries({
          queryKey: trpc.integration.getHealth.queryKey({ provider }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.integration.getAllHealth.queryKey(),
        });
        onDisconnectDialogClose?.();
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('providerToasts.disconnectFailed', { provider: displayName }));
      },
    }),
  );

  const handleDisconnect = () => {
    disconnectMutation.mutate({ provider });
  };

  const connectionStatus = health?.status ?? 'DISCONNECTED';

  return {
    t,
    health,
    connectionStatus,
    syncItems,
    syncLogQuery,
    handleLoadMoreSync,
    webhookItems,
    webhookLogQuery,
    handleLoadMoreWebhook,
    handleReauthorize,
    handleDisconnect,
    isDisconnectPending: disconnectMutation.isPending,
  } as const;
}
