// Phase 83 · Plan 01 · US-INFRA-01 (SC#1 creation) — Wave 0 RED scaffold.
//
// Pins the creation-time data-residency assignment that Plan 02 builds in the
// Better Auth `organizationCreation.beforeCreate` hook (`packages/auth/src/config.ts`).
// RED is the EXPECTED Wave 0 state: today NO code sets `dataRegion` (all orgs
// default to schema `@default(EU)`), and `resolveDataRegionFromBilling` does not
// exist yet — so this file fails at import until Plan 02 lands the mapping + hook.
// Do NOT implement the hook here.
//
// Contract under test (from 83-RESEARCH Pattern 2 / plan <interfaces>):
//   - a create payload carrying a US billing-country selection → dataRegion: 'US'
//   - an EU/ME selection (or absent billing country) → dataRegion: 'EU' (default)
//   - `dataRegion` is set ONLY at creation (beforeCreate); IMMUTABLE afterward
//     (D-01) — there is no afterCreate / update path that sets it.

import { describe, expect, it } from 'vitest';

// Plan 02 exports this pure mapping helper from config.ts; the hook delegates to
// it. Importing it (rather than booting the full Better Auth server) keeps the
// assignment logic unit-testable. RED until Plan 02 adds the export.
import { resolveDataRegionFromBilling } from '../config.js';

describe('organization creation → dataRegion (US-INFRA-01, SC#1 — Wave 0 RED until Plan 02)', () => {
  it('maps a US billing-country selection to dataRegion: US', () => {
    expect(resolveDataRegionFromBilling({ billingCountry: 'US' })).toBe('US');
  });

  it('maps an EU billing-country selection to dataRegion: EU (default residency)', () => {
    expect(resolveDataRegionFromBilling({ billingCountry: 'DE' })).toBe('EU');
  });

  it('maps a Gulf/ME billing-country selection to its home region (not US)', () => {
    // A non-US billing country must never resolve to US data residency.
    expect(resolveDataRegionFromBilling({ billingCountry: 'AE' })).not.toBe('US');
  });

  it('defaults to EU when no billing country is provided (US must be explicit)', () => {
    // US residency is opt-in at creation; absence must never silently route to US.
    expect(resolveDataRegionFromBilling({})).toBe('EU');
    expect(resolveDataRegionFromBilling({ billingCountry: undefined })).toBe('EU');
  });

  it('does not expose an update/afterCreate path for dataRegion (immutability intent, D-01)', () => {
    // The Better Auth org plugin must set dataRegion ONLY in beforeCreate. There
    // is no resolver variant that mutates an existing org's region — region is
    // immutable after creation. This asserts the contract surface stays
    // creation-only (Plan 02 wires the beforeCreate hook; no update setter).
    const cfg = resolveDataRegionFromBilling as unknown as Record<string, unknown>;
    expect(cfg.updateDataRegion).toBeUndefined();
  });
});
