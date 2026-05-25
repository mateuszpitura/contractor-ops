// Decision: tab gated upstream by SettingsIndexContainer (`isPlatformAdmin`). View branches on
// isLoading/empty internally — kept in view for test compatibility.

import { FeatureFlagsTab } from './feature-flags-tab.js';
import { useFeatureFlagsTab } from './hooks/use-feature-flags-tab.js';

export function FeatureFlagsTabContainer() {
  const tab = useFeatureFlagsTab();
  return <FeatureFlagsTab {...tab} />;
}
