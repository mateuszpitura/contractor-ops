import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export const NOTIFICATION_TYPES = [
  'APPROVAL_REQUEST',
  'APPROVAL_DECISION',
  'TASK_ASSIGNED',
  'TASK_OVERDUE',
  'CONTRACT_EXPIRING',
  'INVOICE_RECEIVED',
] as const;

const preferenceFormSchema = z.object({
  preferences: z.array(
    z.object({
      notificationType: z.string(),
      channelEmail: z.boolean(),
      channelSlack: z.boolean(),
      channelTeams: z.boolean(),
    }),
  ),
});

export type PreferenceFormValues = z.infer<typeof preferenceFormSchema>;

export function useNotificationPreferences() {
  const trpc = useTRPC();
  const t = useTranslations('Settings');
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery(trpc.notification.getPreferences.queryOptions());
  const slackStatusQuery = useQuery(trpc.integration.getSlackStatus.queryOptions());
  const teamsHealthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: 'microsoft_teams' }),
  );

  const isSlackConnected = slackStatusQuery.data?.connected === true;
  const isTeamsConnected =
    (teamsHealthQuery.data as { status?: string } | null | undefined)?.status === 'CONNECTED';

  const form = useForm<PreferenceFormValues>({
    resolver: zodResolver(preferenceFormSchema),
    defaultValues: {
      preferences: NOTIFICATION_TYPES.map(type => ({
        notificationType: type,
        channelEmail: true,
        channelSlack: true,
        channelTeams: false,
      })),
    },
  });

  useEffect(() => {
    if (preferencesQuery.data) {
      const prefs = preferencesQuery.data;
      form.reset({
        preferences: NOTIFICATION_TYPES.map(type => {
          const pref = prefs.find((p: { notificationType: string }) => p.notificationType === type);
          return {
            notificationType: type,
            channelEmail: pref?.channelEmail ?? true,
            channelSlack: pref?.channelSlack ?? true,
            channelTeams: pref?.channelTeams ?? false,
          };
        }),
      });
    }
  }, [preferencesQuery.data, form]);

  const updateMutation = useMutation(
    trpc.notification.updatePreferences.mutationOptions({
      onSuccess: () => {
        toast.success(t('notifications.preferencesSaved'));
        queryClient.invalidateQueries({
          queryKey: trpc.notification.getPreferences.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('notifications.preferencesSaveFailed'));
      },
    }),
  );

  const onSubmit = (data: PreferenceFormValues) => {
    updateMutation.mutate({ preferences: data.preferences });
  };

  return {
    t,
    form,
    isLoading: preferencesQuery.isLoading,
    isSlackConnected,
    isTeamsConnected,
    onSubmit,
    isSavePending: updateMutation.isPending,
  } as const;
}
