import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle } from 'lucide-react';
import { FeatureGate } from '../layout/feature-gate.js';
import { ProviderConnectionCard } from '../settings/provider-connection-card.js';
import { GoogleWorkspaceBrandIcon } from './brand-icons.js';
import { DirectoryImportWizard } from './google-workspace/directory-import-wizard.js';
import { SyncStatusSection } from './google-workspace/sync-status-section.js';
import { GoogleWorkspaceReconnectBanner } from './google-workspace-reconnect-banner.js';
import { useGoogleWorkspaceProviderSection } from './hooks/use-google-workspace-provider-section.js';

export type GoogleWorkspaceProviderSectionViewProps = Omit<
  ReturnType<typeof useGoogleWorkspaceProviderSection>,
  'isLoading' | 'isError' | 'onRetry'
>;

export function GoogleWorkspaceProviderSection() {
  const { isLoading, isError, onRetry, t, ...rest } = useGoogleWorkspaceProviderSection();
  if (isLoading) return <GoogleWorkspaceProviderSectionSkeleton />;
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
  return <GoogleWorkspaceProviderSectionView t={t} {...rest} />;
}

export function GoogleWorkspaceProviderSectionSkeleton() {
  return (
    <FeatureGate requiredTier="Pro" featureName="Google Workspace integration">
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </FeatureGate>
  );
}

export function GoogleWorkspaceProviderSectionView({
  isConnected,
  needsReauth,
  wizardOpen,
  setWizardOpen,
  onImportClick,
  t,
  scopeCapabilities,
}: GoogleWorkspaceProviderSectionViewProps) {
  return (
    <FeatureGate requiredTier="Pro" featureName="Google Workspace integration">
      <div className="flex h-full flex-col gap-4">
        {isConnected && !needsReauth && (
          <GoogleWorkspaceReconnectBanner scopeCapabilities={scopeCapabilities} />
        )}

        {needsReauth && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('scopeExpansionWarning')}
          </div>
        )}

        <ProviderConnectionCard
          provider="google_workspace"
          displayName="Google Workspace"
          icon={<GoogleWorkspaceBrandIcon className="size-8" />}
          description={isConnected ? t('descriptionConnected') : t('descriptionDisconnected')}
        />

        {isConnected && <SyncStatusSection onImportClick={onImportClick} />}

        <DirectoryImportWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </FeatureGate>
  );
}
