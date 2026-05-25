// Decision: settings section gated upstream by SettingsIndexContainer (`general` tab). Hook owns
// subdomain form + validation mutation; view renders the input + save button.
import { usePortalSubdomainSection } from './hooks/use-portal-subdomain-section.js';
import { PortalSubdomainSection } from './portal-subdomain-section.js';

export function PortalSubdomainSectionContainer() {
  const section = usePortalSubdomainSection();
  return <PortalSubdomainSection {...section} />;
}
