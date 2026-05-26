import type { ReactNode } from 'react';

import { UpgradeInlineBanner } from './upgrade-inline-banner';

interface FeatureGateProps {
  requiredTier: 'Pro' | 'Enterprise';
  featureName: string;
  isLoading: boolean;
  isAllowed: boolean;
  children: ReactNode;
}

export function FeatureGate({
  requiredTier,
  featureName,
  isLoading,
  isAllowed,
  children,
}: FeatureGateProps) {
  if (isLoading) {
    return <>{children}</>;
  }

  if (!isAllowed) {
    return <UpgradeInlineBanner featureName={featureName} requiredTier={requiredTier} />;
  }

  return <>{children}</>;
}
