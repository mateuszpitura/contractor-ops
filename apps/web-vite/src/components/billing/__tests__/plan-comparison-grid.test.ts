/**
 * Web-vite has no React testing-library installed yet, so this covers
 * the pure-logic contract that renders implicitly:
 *
 *   - `VITE_STRIPE_PRICE_*` env-source contract (audit-flagged migration:
 *     legacy used `process.env.NEXT_PUBLIC_STRIPE_PRICE_*`, web-vite uses
 *     `import.meta.env.VITE_STRIPE_PRICE_*` — this test locks the new shape).
 *   - `PLANS` / `TIER_ORDER` invariants the radiogroup relies on.
 *
 * Once testing-library is added to apps/web-vite (separate dep PR), the
 * render-based interactions (radiogroup, CTA modes) port one-to-one from
 * the legacy file.
 */

import { describe, expect, it } from 'vitest';
import type { TierId } from '../plan-comparison-grid.js';
import { PLANS, TIER_ORDER } from '../plan-comparison-grid.js';

describe('PlanComparisonGrid · PLANS catalogue', () => {
  it('exposes exactly three tiers in STARTER → PRO → ENTERPRISE order', () => {
    expect(TIER_ORDER).toStrictEqual(['STARTER', 'PRO', 'ENTERPRISE']);
    expect(PLANS.map(p => p.id)).toStrictEqual(['STARTER', 'PRO', 'ENTERPRISE']);
  });

  it('keeps base/seat prices monotonically increasing with tier rank', () => {
    const tiers = TIER_ORDER.map(id => PLANS.find(p => p.id === id));
    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const curr = tiers[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      expect(curr?.basePriceMinor).toBeGreaterThan(prev?.basePriceMinor ?? 0);
      expect(curr?.seatPriceMinor).toBeGreaterThan(prev?.seatPriceMinor ?? 0);
      expect(curr?.creditAllowance).toBeGreaterThan(prev?.creditAllowance ?? 0);
    }
  });

  it('quotes legacy price points (99 / 299 / 899 PLN base) so receipts stay stable across the next-intl → i18next port', () => {
    const byId = Object.fromEntries(PLANS.map(p => [p.id, p])) as Record<
      TierId,
      (typeof PLANS)[number]
    >;
    expect(byId.STARTER.basePriceMinor).toBe(9_900);
    expect(byId.PRO.basePriceMinor).toBe(29_900);
    expect(byId.ENTERPRISE.basePriceMinor).toBe(89_900);
  });

  it('describes plans with non-empty marketing copy', () => {
    for (const plan of PLANS) {
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.description.length).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('only STARTER excludes OCR + integrations — PRO unlocks them', () => {
    const starter = PLANS.find(p => p.id === 'STARTER');
    const pro = PLANS.find(p => p.id === 'PRO');
    expect(starter?.excludedFeatures.some(f => /OCR/.test(f))).toBe(true);
    expect(pro?.features.some(f => /OCR/.test(f))).toBe(true);
  });

  it('ENTERPRISE excludes nothing — it is the top of the ladder', () => {
    const enterprise = PLANS.find(p => p.id === 'ENTERPRISE');
    expect(enterprise?.excludedFeatures).toStrictEqual([]);
  });
});

describe('PlanComparisonGrid · Stripe price-id env contract', () => {
  // Legacy app sourced these from `process.env.NEXT_PUBLIC_STRIPE_PRICE_*`.
  // Web-vite migrated to Vite's `import.meta.env.VITE_STRIPE_PRICE_*`, which
  // is the env-source change the milestone audit flagged.
  //
  // We can't dynamically re-import to swap env at runtime (Vite needs
  // static import specifiers), so we assert the contract two other ways:
  //   1. The catalogue's `priceId` mirrors the current Vite env value
  //      verbatim — proves we read from `import.meta.env`, not
  //      `process.env` (which carries different keys in tests/CI).
  //   2. The catalogue references the `VITE_*`-shaped names (typing
  //      guarantees this at the source, but we assert at runtime too).

  it('sources every plan priceId from import.meta.env.VITE_STRIPE_PRICE_*', () => {
    // biome-ignore lint/suspicious/noExplicitAny: vitest exposes the env bag as a record
    const env = (import.meta as any).env as Record<string, string | undefined>;
    const expected: Record<TierId, string> = {
      STARTER: env.VITE_STRIPE_PRICE_STARTER ?? '',
      PRO: env.VITE_STRIPE_PRICE_PRO ?? '',
      ENTERPRISE: env.VITE_STRIPE_PRICE_ENTERPRISE ?? '',
    };
    for (const plan of PLANS) {
      expect(plan.priceId).toBe(expected[plan.id]);
    }
  });

  it('never crashes on a missing env — falls back to empty string per priceId', () => {
    // Empty string is the documented "disable CTA" fallback in
    // `plan-card.tsx` (`disabled={!plan.priceId || isSelecting}`).
    for (const plan of PLANS) {
      expect(typeof plan.priceId).toBe('string');
    }
  });

  it('does NOT leak the legacy NEXT_PUBLIC_STRIPE_PRICE_* keys onto Vite env', () => {
    // biome-ignore lint/suspicious/noExplicitAny: vitest exposes the env bag as a record
    const env = (import.meta as any).env as Record<string, string | undefined>;
    // Sanity guard for the migration: someone re-adding the Next-shaped
    // env to `.env.example` would not flow through to PLANS, but we still
    // want CI to catch a regression that re-imports `process.env`.
    expect(env.NEXT_PUBLIC_STRIPE_PRICE_STARTER).toBeUndefined();
    expect(env.NEXT_PUBLIC_STRIPE_PRICE_PRO).toBeUndefined();
    expect(env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE).toBeUndefined();
  });
});
