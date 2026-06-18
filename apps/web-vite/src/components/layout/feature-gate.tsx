import type { FlagKey } from '@contractor-ops/feature-flags/browser';
import type { ReactNode } from 'react';
import { BillingTierGate } from '../billing/billing-tier-gate.js';
import { useFlag } from './feature-flag-context.js';

interface FeatureGateProps {
  /** Unleash feature flag — when set, section hidden when flag is off. */
  flag?: FlagKey;
  /** Billing tier gate — when set, shows upgrade banner when tier insufficient. */
  requiredTier?: 'Pro' | 'Enterprise';
  featureName?: string;
  children: ReactNode;
}

/**
 * Calls the Unleash flag hook unconditionally (rendered only when a flag is
 * set), so the gate honours the rules-of-hooks while still being optional on
 * {@link FeatureGate}.
 */
function FlagGate({ flag, children }: { flag: FlagKey; children: ReactNode }) {
  const enabled = useFlag(flag);
  return enabled ? children : null;
}

/**
 * Unified gate at container boundary: Unleash flag and/or billing tier.
 */
export function FeatureGate({ flag, requiredTier, featureName, children }: FeatureGateProps) {
  const gated =
    requiredTier && featureName ? (
      <BillingTierGate requiredTier={requiredTier} featureName={featureName}>
        {children}
      </BillingTierGate>
    ) : (
      children
    );

  return flag ? <FlagGate flag={flag}>{gated}</FlagGate> : gated;
}
