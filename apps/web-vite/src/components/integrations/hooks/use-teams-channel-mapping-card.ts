import type { AppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterInputs } from '@trpc/server';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { NotificationCategory, TeamsChannel } from '../teams-channel-mapping.constants.js';
import {
  CATEGORY_LABEL_KEYS,
  NOTIFICATION_CATEGORIES,
} from '../teams-channel-mapping.constants.js';

export {
  CATEGORY_LABEL_KEYS,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type TeamsChannel,
};

type SaveChannelMappingInput = inferRouterInputs<AppRouter>['teams']['saveChannelMapping'];

export interface TeamsTeam {
  id: string;
  displayName: string;
}

export function useTeamsChannelMappingCard() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.teams');
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({});

  const teamsQuery = useQuery(trpc.teams.getTeams.queryOptions());
  const teams: TeamsTeam[] = teamsQuery.data ?? [];

  useEffect(() => {
    if (teams.length === 1 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const channelsQuery = useQuery({
    ...trpc.teams.getChannels.queryOptions({ teamId: selectedTeamId ?? '' }),
    enabled: !!selectedTeamId,
  });
  const channels: TeamsChannel[] = channelsQuery.data ?? [];

  const mappingQuery = useQuery(trpc.teams.getChannelMapping.queryOptions());

  useEffect(() => {
    if (mappingQuery.data) {
      setLocalMapping(mappingQuery.data);
    }
  }, [mappingQuery.data]);

  const saveMutation = useMutation({
    ...trpc.teams.saveChannelMapping.mutationOptions(),
    onSuccess: () => {
      toast.success(t('mappingSaved'));
      queryClient.invalidateQueries({
        queryKey: trpc.teams.getChannelMapping.queryKey(),
      });
    },
    onError: () => {
      toast.error(t('mappingSaveFailed'));
    },
  });

  const handleChannelSelect = (category: string, channelId: string) => {
    setLocalMapping(prev => ({ ...prev, [category]: channelId }));
  };

  const handleSave = () => {
    const mapping: Partial<SaveChannelMappingInput['mapping']> = {};
    for (const category of NOTIFICATION_CATEGORIES) {
      const channelId = localMapping[category];
      if (channelId) mapping[category] = channelId;
    }
    saveMutation.mutate({ mapping: mapping as SaveChannelMappingInput['mapping'] });
  };

  const handleRefresh = () => {
    if (selectedTeamId) {
      queryClient.invalidateQueries({
        queryKey: trpc.teams.getChannels.queryKey({
          teamId: selectedTeamId,
        }),
      });
    }
    queryClient.invalidateQueries({
      queryKey: trpc.teams.getTeams.queryKey(),
    });
  };

  const isLoadingChannels = channelsQuery.isLoading || channelsQuery.isFetching;
  const isChannelError = channelsQuery.isError;

  return {
    selectedTeamId,
    setSelectedTeamId,
    teams,
    channels,
    localMapping,
    handleChannelSelect,
    handleSave,
    handleRefresh,
    isLoadingChannels,
    isChannelError,
    saveMutation,
    t,
  } as const;
}
