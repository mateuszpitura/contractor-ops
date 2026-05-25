// Decision: provider section mounted by IntegrationsTab (gated upstream by canManageIntegrations).
// Hook owns connection state; view renders connection card + setup-dialog opener.
import { useKsefProviderSection } from './hooks/use-integrations-tab.js';
import { KsefProviderSection } from './ksef-provider-section.js';

export function KsefProviderSectionContainer() {
  const section = useKsefProviderSection();
  return <KsefProviderSection {...section} />;
}
