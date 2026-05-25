// Decision: provider section mounted by IntegrationsTab (already gated upstream by canManageIntegrations
// tab visibility). View internally branches on isLoading/connection state — branches stay in view
// for test-contract compatibility (see __tests__/dpd-provider-section.test.tsx).
import { DpdProviderSection } from './dpd-provider-section.js';
import { useDpdProviderSection } from './hooks/use-dpd-provider-section.js';

export function DpdProviderSectionContainer() {
  const section = useDpdProviderSection();
  return <DpdProviderSection {...section} />;
}
