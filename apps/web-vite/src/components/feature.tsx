/**
 * Declarative feature-flag gate. Step 11 codemod port from
 * apps/web/src/components/feature.tsx:
 *   - `@/components/layout/feature-flag-context`
 *       → `./layout/feature-flag-context.js`
 */

import type { FlagKey } from '@contractor-ops/feature-flags/browser';
import type { ReactNode } from 'react';

import { useFlag } from './layout/feature-flag-context.js';

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
