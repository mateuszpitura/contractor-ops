import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertCircle, Store } from 'lucide-react';

import { useFlag } from '../layout/feature-flag-context.js';
import { FeatureGate } from '../layout/feature-gate.js';
import type { MarketplaceTabViewProps } from './hooks/use-marketplace-tab.js';
import { useMarketplaceTab } from './hooks/use-marketplace-tab.js';
import { ListingCard } from './marketplace/listing-card.js';

export function MarketplaceTab() {
  const enabled = useFlag('module.developer-portal');
  if (!enabled) return null;
  return <MarketplaceTabContainer />;
}

function MarketplaceTabContainer() {
  const tab = useMarketplaceTab();
  return <MarketplaceTabView {...tab} />;
}

export function MarketplaceTabView({
  t,
  listings,
  isLoading,
  isError,
  refetch,
  advance,
  isUpdating,
  updatingPlatform,
}: MarketplaceTabViewProps) {
  return (
    <FeatureGate requiredTier="Enterprise" featureName="Marketplace listings">
      <section className="space-y-4">
        <header>
          <h3 className="text-sm font-semibold">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </header>

        {isLoading ? (
          <div
            role="status"
            aria-label={t('title')}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map(i => (
              <Skeleton key={i} className="h-52 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
            <AlertCircle aria-hidden="true" className="size-6 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('errorHeading')}</p>
              <p className="text-xs text-muted-foreground">{t('errorBody')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : !listings || listings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Store aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{t('emptyHeading')}</p>
            <p className="text-xs text-muted-foreground">{t('emptyBody')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                t={t}
                isUpdating={isUpdating && updatingPlatform === listing.platform}
                onAdvance={advance}
              />
            ))}
          </div>
        )}
      </section>
    </FeatureGate>
  );
}
