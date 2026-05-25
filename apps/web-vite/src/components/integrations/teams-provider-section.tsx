import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { UserCog } from 'lucide-react';

import { FeatureGateContainer } from '../billing/feature-gate-container.js';
import { ProviderConnectionCardContainer } from '../settings/provider-connection-card-container.js';
import { TeamsBrandIcon } from './brand-icons.js';
import type { useTeamsProviderSection } from './hooks/use-teams-provider-section.js';
import { TeamsChannelMappingCard } from './teams-channel-mapping-card-container.js';
import { TeamsFallbackApproverDialog } from './teams-fallback-approver-dialog-container.js';

export type TeamsProviderSectionViewProps = Omit<
  ReturnType<typeof useTeamsProviderSection>,
  'isLoading'
>;

export function TeamsProviderSectionSkeleton() {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Microsoft Teams integration">
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </FeatureGateContainer>
  );
}

export function TeamsProviderSectionView({
  isConnected,
  defaultTeamId,
  defaultFallbackApproverId,
  fallbackOpen,
  setFallbackOpen,
  handleOpenFallback,
  t,
  tFb,
}: TeamsProviderSectionViewProps) {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Microsoft Teams integration">
      <div className="flex h-full flex-col gap-4">
        <ProviderConnectionCardContainer
          provider="microsoft_teams"
          displayName="Microsoft Teams"
          icon={<TeamsBrandIcon className="size-8" />}
          description={isConnected ? t('descriptionConnected') : t('descriptionDisconnected')}
        />

        {!!isConnected && <TeamsChannelMappingCard />}

        {!!isConnected && !!defaultTeamId && (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{tFb('cardTitle')}</p>
              <p className="text-xs text-muted-foreground">{tFb('cardBody')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenFallback}>
              <UserCog className="me-2 size-4" />
              {tFb('configureCta')}
            </Button>
          </div>
        )}

        {!!defaultTeamId && (
          <TeamsFallbackApproverDialog
            teamId={defaultTeamId}
            currentFallbackApproverId={defaultFallbackApproverId}
            open={fallbackOpen}
            onOpenChange={setFallbackOpen}
          />
        )}
      </div>
    </FeatureGateContainer>
  );
}
