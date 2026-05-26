import { ApiKeysTab } from './api-keys-tab.js';
import { useApiKeysTab } from './hooks/use-api-keys-tab.js';

// Decision: data-table host — keys table gated by SettingsIndexContainer
// (`canManageIntegrations`) and FeatureGateContainer (Enterprise tier); view delegates
// loading/empty row variants to the shared table shell.
export function ApiKeysTabContainer() {
  const tab = useApiKeysTab();
  return <ApiKeysTab {...tab} />;
}
