import { useIntegrationsTab } from './hooks/use-integrations-tab.js';
import { IntegrationsTab } from './integrations-tab.js';

// Decision: composition — orchestrates the provider sub-cards into the integrations tab;
// gated upstream by SettingsIndexContainer (`canManageIntegrations`).
export function IntegrationsTabContainer() {
  const tab = useIntegrationsTab();
  return <IntegrationsTab {...tab} />;
}
