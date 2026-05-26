import { useTeamsChannelMappingCard } from './hooks/use-teams-channel-mapping-card.js';
import type { ChannelMappingVariant } from './teams-channel-mapping-card.js';
import { TeamsChannelMappingCardView } from './teams-channel-mapping-card.js';

/**
 * Decisive: variant pick — collapses `(isChannelError | isLoadingChannels |
 * selectedTeamId && empty | list)` flag matrix into a single `variant` string
 * passed to the presentational view.
 */
export function TeamsChannelMappingCard() {
  const { isLoadingChannels, isChannelError, selectedTeamId, channels, ...rest } =
    useTeamsChannelMappingCard();

  let variant: ChannelMappingVariant;
  if (isChannelError) variant = 'error';
  else if (isLoadingChannels) variant = 'loading';
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
