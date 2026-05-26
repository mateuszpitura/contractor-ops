/**
 * Feature-flag React context. Lifted from
 * apps/web/src/components/layout/feature-flag-context.tsx unchanged.
 *
 * The legacy layout populated `<FeatureFlagProvider bag={...}>` from a
 * server-resolved flag bag. In the SPA the bag arrives via a tRPC query
 * at the dashboard shell mount (`flag.list.queryOptions()`); the
 * provider stays identical.
 */

import type { FlagKey, FlagValues } from '@contractor-ops/feature-flags/browser';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

const FeatureFlagContext = createContext<FlagValues | null>(null);

export function FeatureFlagProvider({ bag, children }: { bag: FlagValues; children: ReactNode }) {
  const value = useMemo(() => bag, [bag]);
  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

export function useFlagBag(): FlagValues {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) {
    throw new Error('useFlagBag must be used within a FeatureFlagProvider');
  }
  return ctx;
}

export function useFlag(key: FlagKey): boolean {
  return useFlagBag()[key];
}
