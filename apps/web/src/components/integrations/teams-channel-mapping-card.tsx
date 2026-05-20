'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FeatureGate } from '@/components/billing/feature-gate';
import { tKey } from '@/i18n/typed-keys';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_CATEGORIES = [
  'approvals',
  'invoices',
  'contracts',
  'tasks',
  'equipment',
] as const;

type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

const CATEGORY_LABEL_KEYS: Record<NotificationCategory, string> = {
  approvals: 'categoryApprovals',
  invoices: 'categoryInvoices',
  contracts: 'categoryContracts',
  tasks: 'categoryTasks',
  equipment: 'categoryEquipment',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamsTeam {
  id: string;
  displayName: string;
}

interface TeamsChannel {
  id: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// Channel mapping content (extracted to reduce conditional nesting)
// ---------------------------------------------------------------------------

function ChannelMappingContent({
  isLoading,
  isError,
  selectedTeamId,
  channels,
  localMapping,
  onChannelSelect,
  onSave,
  isSaving,
  t,
}: {
  isLoading: boolean;
  isError: boolean;
  selectedTeamId: string | null;
  channels: TeamsChannel[];
  localMapping: Record<string, string>;
  onChannelSelect: (category: string, channelId: string) => void;
  onSave: () => void;
  isSaving: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (isError) {
    return <p className="text-sm text-destructive">{t('channelFetchError')}</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {NOTIFICATION_CATEGORIES.map(cat => (
          <div
            key={cat}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full sm:w-64" />
          </div>
        ))}
      </div>
    );
  }

  if (selectedTeamId && channels.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noChannels')}</p>;
  }

  if (channels.length === 0) return null;

  return (
    <>
      {NOTIFICATION_CATEGORIES.map(category => (
        <div
          key={category}
          className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold">{tKey(t, CATEGORY_LABEL_KEYS[category])}</span>
          <Select
            value={localMapping[category] ?? undefined}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
            onValueChange={v => v && onChannelSelect(category, v)}>
            <SelectTrigger
              className="w-full sm:w-64"
              aria-label={`${tKey(t, CATEGORY_LABEL_KEYS[category])} notification channel`}>
              <SelectValue placeholder={t('selectChannel')} />
            </SelectTrigger>
            <SelectContent>
              {channels.map(ch => (
                <SelectItem key={ch.id} value={ch.id}>
                  {ch.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={isSaving}>
          {!!isSaving && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
          {t('saveMapping')}
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamsChannelMappingCard() {
  const t = useTranslations('Settings.integrations.teams');
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({});

  // ---- Fetch joined teams ----
  const teamsQuery = useQuery(trpc.teams.getTeams.queryOptions());
  const teams = (teamsQuery.data ?? []) as TeamsTeam[];

  // ---- Auto-select single team ----
  useEffect(() => {
    if (teams.length === 1 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // ---- Fetch channels for selected team ----
  const channelsQuery = useQuery({
    ...trpc.teams.getChannels.queryOptions({ teamId: selectedTeamId ?? '' }),
    enabled: !!selectedTeamId,
  });
  const channels = (channelsQuery.data ?? []) as TeamsChannel[];

  // ---- Fetch existing mapping ----
  const mappingQuery = useQuery(trpc.teams.getChannelMapping.queryOptions());

  // ---- Populate local mapping from server ----
  useEffect(() => {
    if (mappingQuery.data) {
      setLocalMapping(mappingQuery.data as Record<string, string>);
    }
  }, [mappingQuery.data]);

  // ---- Save mutation ----
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

  // ---- Handlers ----
  function handleChannelSelect(category: string, channelId: string) {
    setLocalMapping(prev => ({ ...prev, [category]: channelId }));
  }

  function handleSave() {
    (saveMutation.mutate as unknown as (input: { mapping: Record<string, string> }) => void)({
      mapping: localMapping,
    });
  }

  function handleRefresh() {
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
  }

  const isLoadingChannels = channelsQuery.isLoading || channelsQuery.isFetching;
  const isChannelError = channelsQuery.isError;

  return (
    <FeatureGate requiredTier="Pro" featureName="Teams channel mapping">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-lg font-semibold">{t('channelMappingHeading')}</h4>
              <p className="text-sm text-muted-foreground">{t('channelMappingDescription')}</p>
            </div>
            <Tooltip>
              <TooltipTrigger render={<div className="inline-flex" />}>
                <Button
                  variant="ghost"
                  size="icon"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={handleRefresh}
                  disabled={isLoadingChannels}
                  aria-label={t('refreshChannels')}>
                  {isLoadingChannels ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('refreshChannels')}</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Team selector (only if multiple teams) */}
          {teams.length > 1 && (
            <Select
              value={selectedTeamId ?? undefined}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onValueChange={v => v && setSelectedTeamId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectChannel')} />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <ChannelMappingContent
            isLoading={isLoadingChannels}
            isError={isChannelError}
            selectedTeamId={selectedTeamId}
            channels={channels}
            localMapping={localMapping}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onChannelSelect={handleChannelSelect}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onSave={handleSave}
            isSaving={saveMutation.isPending}
            t={t}
          />
        </CardContent>
      </Card>
    </FeatureGate>
  );
}
