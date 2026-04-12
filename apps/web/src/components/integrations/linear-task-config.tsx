'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';
import { LinearLogo } from './linear-logo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinearTaskConfigData {
  linearEnabled: boolean;
  linearTeamId?: string;
  linearTeamKey?: string;
  linearTeamName?: string;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

interface LinearTaskConfigProps {
  taskTemplateId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinearTaskConfig({ taskTemplateId }: LinearTaskConfigProps) {
  const t = useTranslations('Settings.integrations.linear.templateSettings');
  const tI = useTranslations('Integrations.linear.taskConfig');
  const queryClient = useQueryClient();
  const [linearEnabled, setLinearEnabled] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Check if Linear is connected
  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const connection = connectionQuery.data as { id: string; status: string } | null | undefined;
  const isConnected =
    connection?.status === 'CONNECTED' || connection?.status === 'PENDING_MAPPING';

  // Fetch teams when connected
  const teamsQuery = useQuery({
    ...trpc.linear.teams.queryOptions(),
    enabled: isConnected,
  });
  const teams = (teamsQuery.data ?? []) as LinearTeam[];

  // Fetch existing task config
  const configQuery = useQuery({
    ...trpc.jira.getTaskConfig.queryOptions({ taskTemplateId }),
    enabled: !!connection,
  });

  // Extract Linear config from the shared configJson
  const existingConfig = configQuery.data as
    | (Record<string, unknown> & LinearTaskConfigData)
    | undefined;

  // Sync local state with server data
  useEffect(() => {
    if (existingConfig) {
      setLinearEnabled(existingConfig.linearEnabled ?? false);
      setSelectedTeamId(existingConfig.linearTeamId ?? null);
    }
  }, [existingConfig]);

  // Save mutation
  const saveMutation = useMutation({
    ...trpc.linear.saveTaskConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(tI('configSaved'));
      queryClient.invalidateQueries({
        queryKey: trpc.jira.getTaskConfig.queryKey({ taskTemplateId }),
      });
    },
    onError: () => {
      toast.error(tI('configSaveFailed'));
      setLinearEnabled(existingConfig?.linearEnabled ?? false);
      setSelectedTeamId(existingConfig?.linearTeamId ?? null);
    },
  });

  // Don't render if Linear is not connected
  if (!(connection && isConnected)) {
    return null;
  }

  function handleToggle(checked: boolean) {
    if (!selectedTeamId && checked) return;
    setLinearEnabled(checked);

    const team = teams.find(t => t.id === selectedTeamId);
    saveMutation.mutate({
      taskTemplateId,
      config: {
        linearEnabled: checked,
        linearTeamId: selectedTeamId ?? undefined,
        linearTeamKey: team?.key,
        linearTeamName: team?.name,
      },
    });
  }

  function handleTeamChange(teamId: string) {
    setSelectedTeamId(teamId);
    const team = teams.find(t => t.id === teamId);
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
  }

  const teamSummary = selectedTeamId
    ? (teams.find(t => t.id === selectedTeamId)?.name ?? tI('notConfigured'))
    : tI('notConfigured');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id={`linear-toggle-${taskTemplateId}`}
            checked={linearEnabled}
            onCheckedChange={handleToggle}
            disabled={!selectedTeamId || saveMutation.isPending}
          />
          <Label htmlFor={`linear-toggle-${taskTemplateId}`} className="cursor-pointer text-sm">
            {t('enableToggle')}
          </Label>
        </div>

        {/* Team summary */}
        <span className={`flex-1 text-sm ${selectedTeamId ? '' : 'text-muted-foreground'}`}>
          {teamSummary}
        </span>
      </div>

      {/* Team selector */}
      <div className="flex items-center gap-2">
        <LinearLogo className="size-4" />
        <Label className="text-sm">{t('teamLabel')}</Label>
        <Select
          value={selectedTeamId ?? undefined}
          onValueChange={v => {
            if (v) handleTeamChange(v);
          }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('teamPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {teams.map(team => (
              <SelectItem key={team.id} value={team.id}>
                {team.name} ({team.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
