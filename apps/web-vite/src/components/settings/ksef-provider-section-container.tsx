import { useKsefProviderSection } from './hooks/use-integrations-tab.js';
import { KsefProviderSection } from './ksef-provider-section.js';

// Decision: mutation host — provider section mounted by IntegrationsTab (gated upstream
// by `canManageIntegrations`); hook exposes connection state + connect/disconnect handlers.
export function KsefProviderSectionContainer() {
  const section = useKsefProviderSection();
  return <KsefProviderSection {...section} />;
}
