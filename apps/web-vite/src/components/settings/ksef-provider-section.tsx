import { KsefBrandIcon } from '../integrations/brand-icons';
import { useKsefProviderSection } from './hooks/use-integrations-tab.js';
import { KsefControls } from './ksef-controls.js';
import { KsefSetupDialog } from './ksef-setup-dialog.js';
import { ProviderConnectionCard } from './provider-connection-card.js';

export type KsefProviderSectionViewProps = ReturnType<typeof useKsefProviderSection>;

export function KsefProviderSection() {
  const section = useKsefProviderSection();
  return <KsefProviderSectionView {...section} />;
}

export function KsefProviderSectionView({
  tIntegrations,
  setupDialogOpen,
  setSetupDialogOpen,
  orgNip,
  isConnected,
}: KsefProviderSectionViewProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <ProviderConnectionCard
        provider="ksef"
        displayName="KSeF"
        icon={<KsefBrandIcon className="size-8" />}
        description={tIntegrations('ksef.descriptionDisconnected')}
      />

      {isConnected && <KsefControls />}

      <KsefSetupDialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen} orgNip={orgNip} />
    </div>
  );
}
