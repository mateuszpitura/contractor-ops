// Decision: settings tab section gated upstream by SettingsIndexContainer (`canManageIntegrations`
// tab visibility + FeatureGateContainer Enterprise tier inside the view). View internally branches
// on isLoading/empty for skeleton+empty-state UX — branches stay in view for test-contract
// compatibility (see __tests__/api-keys-tab.test.tsx). Container is the hook ownership boundary.

import { ApiKeysTab } from './api-keys-tab.js';
import { useApiKeysTab } from './hooks/use-api-keys-tab.js';

export function ApiKeysTabContainer() {
  const tab = useApiKeysTab();
  return <ApiKeysTab {...tab} />;
}
