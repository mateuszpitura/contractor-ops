import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle } from 'lucide-react';

import { FeatureGateContainer } from '../billing/feature-gate-container.js';
import { ProviderConnectionCardContainer } from '../settings/provider-connection-card-container.js';
import type { useLinearProviderSection } from './hooks/use-linear-provider-section.js';
import { LinearLogo } from './linear-logo.js';
import { LinearStatusMappingDialog } from './linear-status-mapping-dialog-container.js';

export type LinearProviderSectionViewProps = Omit<
  ReturnType<typeof useLinearProviderSection>,
  'isLoading'
>;

export function LinearProviderSectionSkeleton() {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Linear integration">
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </FeatureGateContainer>
  );
}

export function LinearProviderSectionView({
  isConnected,
  isPendingMapping,
  needsReauth,
  mappingOpen,
  setMappingOpen,
  openMappingDialog,
  t,
}: LinearProviderSectionViewProps) {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Linear integration">
      <div className="flex h-full flex-col gap-4">
        <ProviderConnectionCardContainer
          provider="linear"
          displayName="Linear"
          icon={<LinearLogo className="size-8" />}
          description={t('descriptionDisconnected')}
        />

        {isPendingMapping && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('pendingMappingWarning')}
          </div>
        )}

        {!!(isConnected || isPendingMapping) && (
          <Button variant="outline" size="sm" onClick={openMappingDialog}>
            {t('configureMapping')}
          </Button>
        )}

        {needsReauth && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('scopeExpansionWarning')}
          </div>
        )}

        <LinearStatusMappingDialog open={mappingOpen} onOpenChange={setMappingOpen} />
      </div>
    </FeatureGateContainer>
  );
}
