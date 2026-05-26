import type { ReactNode } from 'react';

import { useFeatureGate } from './hooks/use-billing.js';
import { UpgradeInlineBanner } from './upgrade-inline-banner.js';

interface FeatureGateContainerProps {
  requiredTier: 'Pro' | 'Enterprise';
  featureName: string;
  children: ReactNode;
}

export function FeatureGateContainer({
  requiredTier,
  featureName,
  children,
}: FeatureGateContainerProps) {
  const { isLoading, isAllowed } = useFeatureGate(requiredTier);

  if (isLoading) return <>{children}</>;
  if (!isAllowed) {
    return <UpgradeInlineBanner featureName={featureName} requiredTier={requiredTier} />;
  }
  return <>{children}</>;
}
