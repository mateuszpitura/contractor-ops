import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface LinearTaskConfigData {
  linearEnabled: boolean;
  linearTeamId?: string;
  linearTeamKey?: string;
  linearTeamName?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export function useLinearTaskConfig(taskTemplateId: string) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.linear.templateSettings');
  const tI = useTranslations('Integrations.linear.taskConfig');
  const queryClient = useQueryClient();
  const [linearEnabled, setLinearEnabled] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const connection = connectionQuery.data as { id: string; status: string } | null | undefined;
  const isConnected =
    connection?.status === 'CONNECTED' || connection?.status === 'PENDING_MAPPING';

  const teamsQuery = useQuery({
    ...trpc.linear.teams.queryOptions(),
    enabled: isConnected,
  });
  const teams = (teamsQuery.data ?? []) as LinearTeam[];

  const configQuery = useQuery({
    ...trpc.linear.getTaskConfig.queryOptions({ taskTemplateId }),
    enabled: !!connection,
  });

  const existingConfig = configQuery.data as
    | (Record<string, unknown> & LinearTaskConfigData)
    | undefined;

  useEffect(() => {
    if (existingConfig) {
      setLinearEnabled(existingConfig.linearEnabled ?? false);
      setSelectedTeamId(existingConfig.linearTeamId ?? null);
    }
  }, [existingConfig]);

  const saveMutation = useMutation({
    ...trpc.linear.saveTaskConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(tI('configSaved'));
      queryClient.invalidateQueries({
        queryKey: trpc.linear.getTaskConfig.queryKey({ taskTemplateId }),
      });
    },
    onError: () => {
      toast.error(tI('configSaveFailed'));
      setLinearEnabled(existingConfig?.linearEnabled ?? false);
      setSelectedTeamId(existingConfig?.linearTeamId ?? null);
    },
  });

  const handleToggle = (checked: boolean) => {
    if (!selectedTeamId && checked) return;
    setLinearEnabled(checked);

    const team = teams.find(tm => tm.id === selectedTeamId);
    saveMutation.mutate({
      taskTemplateId,
      config: {
        linearEnabled: checked,
        linearTeamId: selectedTeamId ?? undefined,
        linearTeamKey: team?.key,
        linearTeamName: team?.name,
      },
    });
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    const team = teams.find(tm => tm.id === teamId);
    if (!team) return;

    saveMutation.mutate({
      taskTemplateId,
      config: {
        linearEnabled,
        linearTeamId: teamId,
        linearTeamKey: team.key,
        linearTeamName: team.name,
      },
    });
  };

  const teamSummary = selectedTeamId
    ? (teams.find(tm => tm.id === selectedTeamId)?.name ?? tI('notConfigured'))
    : tI('notConfigured');

  return {
    taskTemplateId,
    connection,
    isConnected,
    teams,
    linearEnabled,
    selectedTeamId,
    handleToggle,
    handleTeamChange,
    saveMutation,
    teamSummary,
    t,
    tI,
  } as const;
}
