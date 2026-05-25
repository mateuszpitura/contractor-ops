import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle } from 'lucide-react';

import { FeatureGateContainer } from '../billing/feature-gate-container.js';
import { ProviderConnectionCardContainer } from '../settings/provider-connection-card-container.js';
import type { useJiraProviderSection } from './hooks/use-jira-provider-section.js';
import { JiraLogo } from './jira-logo.js';
import { JiraStatusMappingDialog } from './jira-status-mapping-dialog-container.js';

export type JiraProviderSectionViewProps = Omit<
  ReturnType<typeof useJiraProviderSection>,
  'isLoading'
>;

export function JiraProviderSectionSkeleton() {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Jira integration">
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </FeatureGateContainer>
  );
}

export function JiraProviderSectionView({
  connection,
  isConnected,
  mappingDialogOpen,
  setMappingDialogOpen,
  openMappingDialog,
  t,
}: JiraProviderSectionViewProps) {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Jira integration">
      <div className="flex h-full flex-col gap-4">
        <ProviderConnectionCardContainer
          provider="jira"
          displayName="Jira"
          icon={<JiraLogo className="size-8" />}
          description={t('jiraProvider.description')}
        />

        {!!isConnected && !!connection?.scopeExpansionNeeded && (
          <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
            <AlertTriangle className="size-4 text-warning" />
            <span className="text-sm text-warning">{t('jiraProvider.scopeWarning')}</span>
          </div>
        )}

        {isConnected && !connection?.scopeExpansionNeeded && (
          <Button variant="outline" size="sm" onClick={openMappingDialog}>
            {t('jiraProvider.configureStatusMapping')}
          </Button>
        )}

        {!!mappingDialogOpen && !!connection && (
          <JiraStatusMappingDialog
            open={mappingDialogOpen}
            onOpenChange={setMappingDialogOpen}
            connectionId={connection.id}
          />
        )}
      </div>
    </FeatureGateContainer>
  );
}
