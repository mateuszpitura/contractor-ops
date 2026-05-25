// Decision: provider section mounted by IntegrationsTab (gated upstream by canManageIntegrations).
// View internally branches on isLoading/connection state — kept in view for test compatibility
// (see __tests__/ups-provider-section.test.tsx).
import { useUpsProviderSection } from './hooks/use-ups-provider-section.js';
import { UpsProviderSection } from './ups-provider-section.js';

export function UpsProviderSectionContainer() {
  const section = useUpsProviderSection();
  return <UpsProviderSection {...section} />;
}
