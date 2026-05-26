import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface CalendarConnection {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
  connectedAt: string | Date | null;
  userId: string | null;
  tokenExpiresAt: string | Date | null;
}

export function useMyCalendarSection() {
  const trpc = useTRPC();
  const t = useTranslations('CalendarSettings');
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery(trpc.calendar.listPersonalConnections.queryOptions());
  const connections = (connectionsQuery.data ?? []) as CalendarConnection[];

  const eventsQuery = useQuery(trpc.calendar.listEvents.queryOptions());
  const eventCount = (eventsQuery.data as { count: number } | undefined)?.count ?? 0;

  const disconnectMutation = useMutation(
    trpc.calendar.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t('disconnectedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.calendar.listPersonalConnections.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.calendar.listEvents.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('disconnectFailedToast'));
      },
    }),
  );

  const googleConnection = connections.find(c => c.provider === 'GOOGLE_CALENDAR');
  const outlookConnection = connections.find(c => c.provider === 'OUTLOOK_CALENDAR');

  const googleOAuthQuery = trpc.integration.getOAuthUrlGeneric.queryOptions({
    provider: 'google-calendar',
  });
  const outlookOAuthQuery = trpc.integration.getOAuthUrlGeneric.queryOptions({
    provider: 'outlook-calendar',
  });

  async function handleGoogleConnect() {
    try {
      const result = await queryClient.fetchQuery(googleOAuthQuery);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error(t('connectFailedToast'));
    }
  }

  async function handleOutlookConnect() {
    try {
      const result = await queryClient.fetchQuery(outlookOAuthQuery);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error(t('connectFailedToast'));
    }
  }

  const handleDisconnect = (connectionId: string) => {
    disconnectMutation.mutate({ connectionId });
  };

  return {
    t,
    isLoading: connectionsQuery.isLoading,
    eventCount,
    googleConnection,
    outlookConnection,
    handleGoogleConnect,
    handleOutlookConnect,
    handleDisconnect,
    isDisconnecting: disconnectMutation.isPending,
  } as const;
}
