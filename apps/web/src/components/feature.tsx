'use client';

import type { FlagKey } from '@contractor-ops/feature-flags';
import type { ReactNode } from 'react';
import { useFlag } from '@/components/layout/feature-flag-context';

/**
 * Declarative gate for UI driven by a feature flag.
 *
 * @example
 *   <Feature flag="module.legal-approval" fallback={<LegacyApproval />}>
 *     <NewLegalApprovalBeta />
 *   </Feature>
 */
export function Feature({
  flag,
  fallback = null,
  children,
}: {
  flag: FlagKey;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return useFlag(flag) ? children : fallback;
}
