import {
  FeatureFlagsTab,
  FeatureFlagsTabError,
  FeatureFlagsTabSkeleton,
} from './feature-flags-tab.js';
import { useFeatureFlagsTab } from './hooks/use-feature-flags-tab.js';

export function FeatureFlagsTabContainer() {
  const tab = useFeatureFlagsTab();
  if (tab.isLoading) return <FeatureFlagsTabSkeleton />;
  if (tab.isError) return <FeatureFlagsTabError t={tab.t} />;
  return <FeatureFlagsTab {...tab} />;
}
