// Decision: tab gated upstream by SettingsIndexContainer (`canManageIntegrations`). View composes
// many provider sub-cards; hook returns provider list. Container is the hook ownership boundary.
import { useIntegrationsTab } from './hooks/use-integrations-tab.js';
import { IntegrationsTab } from './integrations-tab.js';

export function IntegrationsTabContainer() {
  const tab = useIntegrationsTab();
  return <IntegrationsTab {...tab} />;
}
