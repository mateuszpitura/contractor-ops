import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useIntegrationsTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations');
  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider: 'slack' }));
  const slackHealth = healthQuery.data as { status: string } | null | undefined;
  const isSlackConnected = slackHealth?.status === 'CONNECTED';

  return { t, isSlackConnected } as const;
}

export type IntegrationsTabProps = ReturnType<typeof useIntegrationsTab>;

export function useKsefControls() {
  const trpc = useTRPC();
  const t = useTranslations('ksef');
  const queryClient = useQueryClient();

  const connectionQuery = useQuery(trpc.ksef.connectionStatus.queryOptions());
  const connection = connectionQuery.data as
    | { id: string; status: string; lastSyncAt?: string | null }
    | null
    | undefined;
  const isConnected = connection?.status === 'CONNECTED';

  const syncMutation = useMutation({
    ...trpc.ksef.triggerSync.mutationOptions(),
    onSuccess: () => {
      toast.success(t('syncSuccessToast', { count: 0 }));
      queryClient.invalidateQueries({
        queryKey: trpc.ksef.syncHistory.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.ksef.connectionStatus.queryKey(),
      });
    },
    onError: () => {
      toast.error(t('syncFailedToast'));
    },
  });

  const handleSync = () => (syncMutation.mutate as () => void)();

  return {
    t,
    connection,
    isConnected,
    isPending: syncMutation.isPending,
    handleSync,
  } as const;
}

export function useKsefProviderSection() {
  const trpc = useTRPC();
  const tIntegrations = useTranslations('Settings.integrations');
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const orgData = settingsQuery.data as { metadata?: Record<string, unknown> } | null | undefined;
  const orgMetadata = orgData?.metadata ?? {};
  const settingsJson = (orgMetadata.settingsJson as Record<string, unknown>) ?? {};
  const orgNip = (settingsJson.taxId as string) ?? null;

  const connectionQuery = useQuery(trpc.ksef.connectionStatus.queryOptions());
  const ksefConnection = connectionQuery.data as { id: string; status: string } | null | undefined;
  const isConnected = ksefConnection?.status === 'CONNECTED';

  return {
    tIntegrations,
    setupDialogOpen,
    setSetupDialogOpen,
    orgNip,
    isConnected,
  } as const;
}
