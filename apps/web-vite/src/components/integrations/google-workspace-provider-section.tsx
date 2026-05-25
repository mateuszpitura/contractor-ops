import type { ScopeCapabilities } from '@contractor-ops/db';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { FeatureGateContainer } from '../billing/feature-gate-container.js';
import { ProviderConnectionCardContainer } from '../settings/provider-connection-card-container.js';
import { GoogleWorkspaceBrandIcon } from './brand-icons.js';
import { DirectoryImportWizard } from './google-workspace/directory-import-wizard-container.js';
import { SyncStatusSection } from './google-workspace/sync-status-section-container.js';
import { GoogleWorkspaceReconnectBanner } from './google-workspace-reconnect-banner.js';
import type { useGoogleWorkspaceProviderSection } from './hooks/use-google-workspace-provider-section.js';

export type GoogleWorkspaceProviderSectionViewProps = Omit<
  ReturnType<typeof useGoogleWorkspaceProviderSection>,
  'isLoading'
>;

export function GoogleWorkspaceProviderSectionSkeleton() {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Google Workspace integration">
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </FeatureGateContainer>
  );
}

export function GoogleWorkspaceProviderSectionView({
  isConnected,
  wizardOpen,
  setWizardOpen,
  onImportClick,
  t,
  scopeCapabilities,
}: GoogleWorkspaceProviderSectionViewProps) {
  return (
    <FeatureGateContainer requiredTier="Pro" featureName="Google Workspace integration">
      <div className="flex h-full flex-col gap-4">
        {isConnected && (
          <GoogleWorkspaceReconnectBanner
            scopeCapabilities={scopeCapabilities as ScopeCapabilities | null}
          />
        )}

        <ProviderConnectionCardContainer
          provider="google_workspace"
          displayName="Google Workspace"
          icon={<GoogleWorkspaceBrandIcon className="size-8" />}
          description={isConnected ? t('descriptionConnected') : t('descriptionDisconnected')}
        />

        {isConnected && <SyncStatusSection onImportClick={onImportClick} />}

        <DirectoryImportWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </FeatureGateContainer>
  );
}
