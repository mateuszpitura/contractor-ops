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

import { tKey } from '../../i18n/typed-keys.js';
import { FeatureGateContainer } from '../billing/feature-gate-container.js';
import type { useTeamsChannelMappingCard } from './hooks/use-teams-channel-mapping-card.js';
import type { TeamsChannel } from './teams-channel-mapping.constants.js';
import { CATEGORY_LABEL_KEYS, NOTIFICATION_CATEGORIES } from './teams-channel-mapping.constants.js';

export type ChannelMappingVariant = 'loading' | 'error' | 'empty' | 'list';

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
  let body: React.ReactNode = null;
  if (variant === 'error') {
    body = <ChannelMappingError t={t} />;
  } else if (variant === 'loading') {
    body = <ChannelMappingLoading />;
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
    <FeatureGateContainer requiredTier="Pro" featureName="Teams channel mapping">
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

          {body}
        </CardContent>
      </Card>
    </FeatureGateContainer>
  );
}
