import { usePortalSubdomainSection } from './hooks/use-portal-subdomain-section.js';
import { PortalSubdomainSection } from './portal-subdomain-section.js';

// Decision: mutation host — section gated upstream by SettingsIndexContainer (`general`
// tab); hook supplies subdomain form + validation mutation + isPending.
export function PortalSubdomainSectionContainer() {
  const section = usePortalSubdomainSection();
  return <PortalSubdomainSection {...section} />;
}
