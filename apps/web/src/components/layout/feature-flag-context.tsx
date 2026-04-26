'use client';

import type { FlagKey, FlagValues } from '@contractor-ops/feature-flags';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

const FeatureFlagContext = createContext<FlagValues | null>(null);

export function FeatureFlagProvider({ bag, children }: { bag: FlagValues; children: ReactNode }) {
  // Freeze the reference via useMemo so deep consumers don't thrash on every
  // parent re-render. The bag itself is recreated on each request, so identity
  // stability within a request is enough.
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
