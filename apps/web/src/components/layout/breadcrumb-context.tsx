'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type BreadcrumbOverride = {
  /** The raw pathname segment to replace (e.g. the CUID) */
  segment: string;
  /** Human-readable label to display instead */
  label: string;
};

type BreadcrumbContextValue = {
  overrides: Map<string, BreadcrumbOverride>;
  setOverride: (override: BreadcrumbOverride) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  overrides: new Map(),
  setOverride: () => undefined,
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, BreadcrumbOverride>>(new Map());

  const setOverride = useCallback((override: BreadcrumbOverride) => {
    setOverrides(prev => {
      const existing = prev.get(override.segment);
      if (existing?.label === override.label) return prev;
      const next = new Map(prev);
      next.set(override.segment, override);
      return next;
    });
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ overrides, setOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}

/**
 * Hook for detail pages to set their breadcrumb label.
 * Call this in the page component with the entity name once loaded.
 *
 * @example
 * useBreadcrumbOverride(params.id, contractor?.displayName);
 */
export function useBreadcrumbOverride(
  segment: string | undefined,
  label: string | undefined | null,
) {
  const { setOverride } = useBreadcrumbContext();

  useEffect(() => {
    if (segment && label) {
      setOverride({ segment, label });
    }
  }, [segment, label, setOverride]);
}
