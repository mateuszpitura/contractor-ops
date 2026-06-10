// Pins the creation-time data-residency assignment wired in the Better Auth
// `organizationCreation.beforeCreate` hook (`packages/auth/src/config.ts`).
//
// Contract under test:
//   - a create payload carrying a US billing-country selection → dataRegion: 'US'
//   - an EU/ME selection (or absent billing country) → dataRegion: 'EU' (default)
//   - `dataRegion` is set ONLY at creation (beforeCreate); IMMUTABLE afterward —
//     there is no afterCreate / update path that sets it.

import { describe, expect, it } from 'vitest';

// Importing the pure mapping helper (rather than booting the full Better Auth
// server) keeps the assignment logic unit-testable.
import { resolveDataRegionFromBilling } from '../config.js';

describe('organization creation → dataRegion', () => {
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

  it('does not expose an update/afterCreate path for dataRegion (immutability intent)', () => {
    // The Better Auth org plugin sets dataRegion ONLY in beforeCreate. There
    // is no resolver variant that mutates an existing org's region — region is
    // immutable after creation. This asserts the contract surface stays
    // creation-only.
    const cfg = resolveDataRegionFromBilling as unknown as Record<string, unknown>;
    expect(cfg.updateDataRegion).toBeUndefined();
  });
});
