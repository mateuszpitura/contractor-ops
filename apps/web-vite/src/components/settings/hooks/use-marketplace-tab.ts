import { useQuery } from '@tanstack/react-query';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export const MARKETPLACE_PLATFORMS = ['ZAPIER', 'N8N', 'MAKE'] as const;
export type MarketplacePlatform = (typeof MARKETPLACE_PLATFORMS)[number];

export const MARKETPLACE_LISTING_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'LIVE',
  'REJECTED',
  'NEEDS_CHANGES',
] as const;
export type MarketplaceListingStatus = (typeof MARKETPLACE_LISTING_STATUSES)[number];

/**
 * Legal next states per current state. Decides which advance options the
 * operator sees; the server re-validates every transition through its own
 * state machine, so this map only shapes the affordance and can never
 * mismark a listing on its own.
 */
export const LISTING_NEXT_STATUSES: Record<
  MarketplaceListingStatus,
  readonly MarketplaceListingStatus[]
> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['IN_REVIEW'],
  IN_REVIEW: ['LIVE', 'REJECTED', 'NEEDS_CHANGES'],
  NEEDS_CHANGES: ['SUBMITTED'],
  REJECTED: ['SUBMITTED'],
  LIVE: ['NEEDS_CHANGES'],
};

export function nextStatusesFor(status: string): readonly MarketplaceListingStatus[] {
  return LISTING_NEXT_STATUSES[status as MarketplaceListingStatus] ?? [];
}

export function useMarketplaceTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.marketplace');

  const {
    data: listings,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.marketplaceListing.list.queryOptions());

  const updateMutation = useResourceMutation(trpc.marketplaceListing.update.mutationOptions(), {
    invalidate: [trpc.marketplaceListing.list.queryKey()],
    successMessage: t('toast.updated'),
    errorMessage: t('toast.updateFailed'),
  });

  function advance(platform: MarketplacePlatform, status: MarketplaceListingStatus) {
    updateMutation.mutate({ platform, status });
  }

  const updatingPlatform = updateMutation.isPending
    ? (updateMutation.variables?.platform ?? null)
    : null;

  return {
    t,
    listings,
    isLoading,
    isError,
    refetch,
    advance,
    isUpdating: updateMutation.isPending,
    updatingPlatform,
  } as const;
}

export type MarketplaceTabViewProps = ReturnType<typeof useMarketplaceTab>;
export type MarketplaceListingRow = NonNullable<MarketplaceTabViewProps['listings']>[number];
