import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { CalendarConnection } from './use-my-calendar-section.js';

export function useOrgCalendarProviderCard(provider: string) {
  const trpc = useTRPC();

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

  return { handleConnect } as const;
}

export function useOrgCalendarSection() {
  const trpc = useTRPC();
  const t = useTranslations('CalendarSettings');
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery(trpc.calendar.listConnections.queryOptions());
  const allConnections = (connectionsQuery.data ?? []) as CalendarConnection[];
  const orgConnections = allConnections.filter(c => c.userId === null);

  const disconnectMutation = useMutation(
    trpc.calendar.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t('disconnectedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.calendar.listConnections.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('disconnectFailedToast'));
      },
    }),
  );

  const googleConnection = orgConnections.find(c => c.provider === 'GOOGLE_CALENDAR');
  const outlookConnection = orgConnections.find(c => c.provider === 'OUTLOOK_CALENDAR');

  const handleDisconnect = (connectionId: string) => {
    disconnectMutation.mutate({ connectionId });
  };

  return {
    t,
    isLoading: connectionsQuery.isLoading,
    googleConnection,
    outlookConnection,
    handleDisconnect,
    isDisconnecting: disconnectMutation.isPending,
  } as const;
}
