import type { FlagKey } from '@contractor-ops/feature-flags/browser';
import type { ReactNode } from 'react';

import { useFlag } from './feature-flag-context.js';
import { BillingTierGate } from '../billing/billing-tier-gate.js';

interface FeatureGateProps {
  /** Unleash feature flag — when set, section hidden when flag is off. */
  flag?: FlagKey;
  /** Billing tier gate — when set, shows upgrade banner when tier insufficient. */
  requiredTier?: 'Pro' | 'Enterprise';
  featureName?: string;
  children: ReactNode;
}

/**
 * Unified gate at container boundary: Unleash flag and/or billing tier.
 */
export function FeatureGate({ flag, requiredTier, featureName, children }: FeatureGateProps) {
  const enabled = flag ? useFlag(flag) : true;

  if (!enabled) return null;

  if (requiredTier && featureName) {
    return (
      <BillingTierGate requiredTier={requiredTier} featureName={featureName}>
        {children}
      </BillingTierGate>
    );
  }

  return <>{children}</>;
}
