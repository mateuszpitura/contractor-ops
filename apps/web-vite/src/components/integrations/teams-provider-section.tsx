import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle, UserCog } from 'lucide-react';

import { FeatureGate } from '../layout/feature-gate.js';
import { ProviderConnectionCard } from '../settings/provider-connection-card.js';
import { TeamsBrandIcon } from './brand-icons.js';
import { useTeamsProviderSection } from './hooks/use-teams-provider-section.js';
import { TeamsChannelMappingCard } from './teams-channel-mapping-card.js';
import { TeamsFallbackApproverDialog } from './teams-fallback-approver-dialog.js';

export type TeamsProviderSectionViewProps = Omit<
  ReturnType<typeof useTeamsProviderSection>,
  'isLoading' | 'isError' | 'onRetry'
>;

export function TeamsProviderSection() {
  const { isLoading, isError, onRetry, t, ...rest } = useTeamsProviderSection();
  if (isLoading) return <TeamsProviderSectionSkeleton />;
  if (isError) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('error')}</p>
        <button type="button" className="text-sm underline" onClick={onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  }
  return <TeamsProviderSectionView t={t} {...rest} />;
}

export function TeamsProviderSectionSkeleton() {
  return (
    <FeatureGate requiredTier="Pro" featureName="Microsoft Teams integration">
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </FeatureGate>
  );
}

export function TeamsProviderSectionView({
  isConnected,
  needsReauth,
  defaultTeamId,
  defaultFallbackApproverId,
  fallbackOpen,
  setFallbackOpen,
  handleOpenFallback,
  t,
  tFb,
}: TeamsProviderSectionViewProps) {
  return (
    <FeatureGate requiredTier="Pro" featureName="Microsoft Teams integration">
      <div className="flex h-full flex-col gap-4">
        {needsReauth ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('scopeExpansionWarning')}
          </div>
        ) : null}

        <ProviderConnectionCard
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
    </FeatureGate>
  );
}
