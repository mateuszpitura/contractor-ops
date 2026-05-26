import { KsefBrandIcon } from '../integrations/brand-icons';
import type { useKsefProviderSection } from './hooks/use-integrations-tab.js';
import { KsefControlsContainer } from './ksef-controls-container.js';
import { KsefSetupDialogContainer } from './ksef-setup-dialog-container.js';
import { ProviderConnectionCardContainer } from './provider-connection-card-container.js';

export type KsefProviderSectionProps = ReturnType<typeof useKsefProviderSection>;

export function KsefProviderSection({
  tIntegrations,
  setupDialogOpen,
  setSetupDialogOpen,
  orgNip,
  isConnected,
}: KsefProviderSectionProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <ProviderConnectionCardContainer
        provider="ksef"
        displayName="KSeF"
        icon={<KsefBrandIcon className="size-8" />}
        description={tIntegrations('ksef.descriptionDisconnected')}
      />

      {isConnected && <KsefControlsContainer />}

      <KsefSetupDialogContainer
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
        orgNip={orgNip}
      />
    </div>
  );
}
