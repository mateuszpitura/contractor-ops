import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type BreadcrumbOverride = { label: string };

type BreadcrumbContextValue = {
  overrides: Map<string, BreadcrumbOverride>;
  setOverride: (segment: string, label: string) => void;
  clearOverride: (segment: string) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, BreadcrumbOverride>>(() => new Map());

  const value = useMemo(
    (): BreadcrumbContextValue => ({
      overrides,
      setOverride: (segment, label) => {
        setOverrides(prev => {
          const next = new Map(prev);
          next.set(segment, { label });
          return next;
        });
      },
      clearOverride: segment => {
        setOverrides(prev => {
          if (!prev.has(segment)) return prev;
          const next = new Map(prev);
          next.delete(segment);
          return next;
        });
      },
    }),
    [overrides],
  );

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    return {
      overrides: new Map(),
      setOverride: () => undefined,
      clearOverride: () => undefined,
    };
  }
  return ctx;
}

/** Detail pages set a human-readable label for a route segment (e.g. contractor id). */
export function useBreadcrumbOverride(
  segment: string | undefined,
  label: string | undefined | null,
): void {
  const { setOverride, clearOverride } = useBreadcrumbContext();

  useEffect(() => {
    if (segment && label) {
      setOverride(segment, label);
      return () => clearOverride(segment);
    }
    return;
  }, [segment, label, setOverride, clearOverride]);
}
