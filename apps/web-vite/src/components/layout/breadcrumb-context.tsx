import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type BreadcrumbOverride = { label: string };

type BreadcrumbContextValue = {
  overrides: Map<string, BreadcrumbOverride>;
  setOverride: (segment: string, label: string) => void;
  clearOverride: (segment: string) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, BreadcrumbOverride>>(() => new Map());

  // Stable callbacks so consumers calling `useBreadcrumbOverride(segment, label)`
  // can list setOverride / clearOverride in their useEffect deps without
  // re-firing the effect on every Provider render. Putting these inside the
  // value `useMemo` block (the previous shape) recreated the function refs
  // every time `overrides` changed, which made every detail page useEffect
  // self-trigger and hit "Maximum update depth exceeded" the moment a user
  // navigated into a detail route from the sidebar.
  const setOverride = useCallback((segment: string, label: string) => {
    setOverrides(prev => {
      const existing = prev.get(segment);
      if (existing && existing.label === label) return prev;
      const next = new Map(prev);
      next.set(segment, { label });
      return next;
    });
  }, []);

  const clearOverride = useCallback((segment: string) => {
    setOverrides(prev => {
      if (!prev.has(segment)) return prev;
      const next = new Map(prev);
      next.delete(segment);
      return next;
    });
  }, []);

  const value = useMemo<BreadcrumbContextValue>(
    () => ({ overrides, setOverride, clearOverride }),
    [overrides, setOverride, clearOverride],
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
