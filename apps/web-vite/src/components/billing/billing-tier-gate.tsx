import type { ReactNode } from 'react';

import { useFeatureGate } from './hooks/use-billing.js';
import { UpgradeInlineBanner } from './upgrade-inline-banner.js';

interface BillingTierGateProps {
  requiredTier: 'Pro' | 'Enterprise';
  featureName: string;
  children: ReactNode;
}

export function BillingTierGate({ requiredTier, featureName, children }: BillingTierGateProps) {
  const { isLoading, isAllowed } = useFeatureGate(requiredTier);

  if (isLoading) return <>{children}</>;
  if (!isAllowed) {
    return <UpgradeInlineBanner featureName={featureName} requiredTier={requiredTier} />;
  }
  return <>{children}</>;
}
