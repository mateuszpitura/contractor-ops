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
import { Loader2, RefreshCw } from 'lucide-react';
import type * as React from 'react';
import { memo, useCallback } from 'react';

import { tKey } from '../../i18n/typed-keys.js';
import { FeatureGate } from '../layout/feature-gate.js';
import { useTeamsChannelMappingCard } from './hooks/use-teams-channel-mapping-card.js';
import type { TeamsChannel } from './teams-channel-mapping.constants.js';
import { CATEGORY_LABEL_KEYS, NOTIFICATION_CATEGORIES } from './teams-channel-mapping.constants.js';

export type ChannelMappingVariant = 'loading' | 'error' | 'empty' | 'selectTeam' | 'list';

export function ChannelMappingError({
  t,
}: {
  t: ReturnType<typeof useTeamsChannelMappingCard>['t'];
}) {
  return <p className="text-sm text-destructive">{t('channelFetchError')}</p>;
}

export function ChannelMappingLoading() {
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

export function ChannelMappingEmpty({
  t,
}: {
  t: ReturnType<typeof useTeamsChannelMappingCard>['t'];
}) {
  return <p className="text-sm text-muted-foreground">{t('noChannels')}</p>;
}

export function ChannelMappingSelectTeamFirst({
  t,
}: {
  t: ReturnType<typeof useTeamsChannelMappingCard>['t'];
}) {
  return <p className="text-sm text-muted-foreground">{t('selectTeamFirst')}</p>;
}

interface CategoryChannelRowProps {
  category: string;
  label: string;
  ariaLabel: string;
  value: string | undefined;
  channels: TeamsChannel[];
  placeholder: string;
  onChannelSelect: (category: string, channelId: string) => void;
}

const CategoryChannelRow = memo(function CategoryChannelRow({
  category,
  label,
  ariaLabel,
  value,
  channels,
  placeholder,
  onChannelSelect,
}: CategoryChannelRowProps) {
  const handleValueChange = useCallback(
    (v: string | null) => {
      if (v) onChannelSelect(category, v);
    },
    [category, onChannelSelect],
  );

  return (
    <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold">{label}</span>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full sm:w-64" aria-label={ariaLabel}>
          <SelectValue placeholder={placeholder} />
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
  );
});

function ChannelMappingList({
  channels,
  localMapping,
  onChannelSelect,
  onSave,
  isSaving,
  t,
}: {
  channels: TeamsChannel[];
  localMapping: Record<string, string>;
  onChannelSelect: (category: string, channelId: string) => void;
  onSave: () => void;
  isSaving: boolean;
  t: ReturnType<typeof useTeamsChannelMappingCard>['t'];
}) {
  return (
    <>
      {NOTIFICATION_CATEGORIES.map(category => {
        const label = tKey(t, CATEGORY_LABEL_KEYS[category]);
        return (
          <CategoryChannelRow
            key={category}
            category={category}
            label={label}
            ariaLabel={`${label} notification channel`}
            value={localMapping[category] ?? undefined}
            channels={channels}
            placeholder={t('selectChannel')}
            onChannelSelect={onChannelSelect}
          />
        );
      })}
      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={isSaving}>
          {!!isSaving && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
          {t('saveMapping')}
        </Button>
      </div>
    </>
  );
}

export type TeamsChannelMappingCardViewProps = Omit<
  ReturnType<typeof useTeamsChannelMappingCard>,
  'isLoadingChannels' | 'isChannelError'
> & {
  variant: ChannelMappingVariant;
  isRefreshing: boolean;
};

export function TeamsChannelMappingCardView({
  selectedTeamId,
  setSelectedTeamId,
  teams,
  channels,
  localMapping,
  handleChannelSelect,
  handleSave,
  handleRefresh,
  isRefreshing,
  variant,
  saveMutation,
  t,
}: TeamsChannelMappingCardViewProps) {
  const handleTeamChange = useCallback(
    (v: string | null) => {
      if (v) setSelectedTeamId(v);
    },
    [setSelectedTeamId],
  );

  let body: React.ReactNode = null;
  if (variant === 'error') {
    body = <ChannelMappingError t={t} />;
  } else if (variant === 'loading') {
    body = <ChannelMappingLoading />;
  } else if (variant === 'selectTeam') {
    body = <ChannelMappingSelectTeamFirst t={t} />;
  } else if (variant === 'empty') {
    body = <ChannelMappingEmpty t={t} />;
  } else {
    body = (
      <ChannelMappingList
        channels={channels}
        localMapping={localMapping}
        onChannelSelect={handleChannelSelect}
        onSave={handleSave}
        isSaving={saveMutation.isPending}
        t={t}
      />
    );
  }

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
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label={t('refreshChannels')}>
                  {isRefreshing ? (
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
          {teams.length > 1 && (
            <Select value={selectedTeamId ?? undefined} onValueChange={handleTeamChange}>
              <SelectTrigger className="w-full" aria-label={t('selectTeam')}>
                <SelectValue placeholder={t('selectTeam')} />
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

          {body}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

export function TeamsChannelMappingCard() {
  const { isLoadingChannels, isChannelError, selectedTeamId, channels, ...rest } =
    useTeamsChannelMappingCard();

  let variant: ChannelMappingVariant;
  if (isChannelError) variant = 'error';
  else if (isLoadingChannels) variant = 'loading';
  else if (rest.teams.length > 1 && !selectedTeamId) variant = 'selectTeam';
  else if (selectedTeamId && channels.length === 0) variant = 'empty';
  else variant = 'list';

  return (
    <TeamsChannelMappingCardView
      {...rest}
      selectedTeamId={selectedTeamId}
      channels={channels}
      variant={variant}
      isRefreshing={isLoadingChannels}
    />
  );
}
