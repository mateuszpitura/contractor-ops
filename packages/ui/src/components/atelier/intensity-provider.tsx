'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

/**
 * Atelier intensity tiers — see docs/UI-ATELIER-WORKPLAN.md §1.3 / §3.3.
 *
 * - exhibition: landing/marketing pages. Cinematic, editorial, no rules
 *   against expensive effects. Single instance per page (the hero).
 * - atelier:    dashboards and insight-heavy product screens. Premium
 *   surfaces, controlled motion, glow allowed on hero metric.
 * - workbench:  tables, forms, approvals, settings, operational pages.
 *   Calmer surfaces, no orbs, no per-row tilt/shimmer/glass, no
 *   atelier-hero-glow. Optimized for legibility on dense pages.
 */
export type AtelierIntensity = 'exhibition' | 'atelier' | 'workbench';

const AtelierIntensityContext = createContext<AtelierIntensity>('atelier');

export function AtelierIntensityProvider({
  value,
  children,
}: {
  value: AtelierIntensity;
  children: ReactNode;
}) {
  return (
    <AtelierIntensityContext.Provider value={value}>{children}</AtelierIntensityContext.Provider>
  );
}

/**
 * Reads the current intensity tier from context. Defaults to 'atelier'
 * when no provider is mounted (most pages on apps/web).
 *
 * Components consult this to self-downgrade — Sparkline drops its
 * pulse dot in workbench, TiltCard becomes static in workbench, etc.
 */
export function useAtelierIntensity(): AtelierIntensity {
  return useContext(AtelierIntensityContext);
}
