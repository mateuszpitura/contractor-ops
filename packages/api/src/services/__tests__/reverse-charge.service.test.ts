// reverse-charge.service extensions.
//
// Covers two new rule paths (gb_eu_post_brexit_b2b, de_domestic_13b_ustg)
// plus a regression block that re-runs core scenarios to guard against drift.

import { describe, expect, it } from 'vitest';
import type { DE13bServiceType } from '../reverse-charge.service';
import { DE_13B_SERVICE_TYPES, detectReverseCharge } from '../reverse-charge.service';

describe('reverse-charge.service — gb_eu_post_brexit_b2b (D-12 rule 1)', () => {
  it('GB seller + EU (DE) buyer, both VAT-registered B2B → reverse charge', () => {
    const out = detectReverseCharge({
      sellerCountry: 'GB',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(true);
    expect(out.rule).toBe('gb_eu_post_brexit_b2b');
    expect(out.reason).toMatch(/post-Brexit|UK↔EU|UK.EU/);
  });

  it('EU (FR) seller + GB buyer, both VAT-registered B2B → reverse charge (inverse direction)', () => {
    const out = detectReverseCharge({
      sellerCountry: 'FR',
      buyerCountry: 'GB',
      buyerHasVatId: true,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(true);
    expect(out.rule).toBe('gb_eu_post_brexit_b2b');
  });

  it('GB → EU without buyer VAT ID → NOT reverse charge', () => {
    const out = detectReverseCharge({
      sellerCountry: 'GB',
      buyerCountry: 'DE',
      buyerHasVatId: false,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });

  it('GB → EU B2C (isB2B=false) → NOT reverse charge', () => {
    const out = detectReverseCharge({
      sellerCountry: 'GB',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: false,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });
});

describe('reverse-charge.service — de_domestic_13b_ustg (D-12 rule 3)', () => {
  it('DE seller → DE buyer + serviceType=CONSTRUCTION → reverse charge (§13b)', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: true,
      serviceType: 'CONSTRUCTION',
    });
    expect(out.shouldApply).toBe(true);
    expect(out.rule).toBe('de_domestic_13b_ustg');
    expect(out.reason).toMatch(/§13b|13b UStG/);
  });

  it('DE → DE + serviceType=CLEANING_BUILDING → reverse charge (§13b)', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: true,
      serviceType: 'CLEANING_BUILDING',
    });
    expect(out.shouldApply).toBe(true);
    expect(out.rule).toBe('de_domestic_13b_ustg');
  });

  it('DE → DE + serviceType outside §13b list → NO §13b rule, falls through to domestic no-RC', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: true,
      // 'UNKNOWN' is not in DE_13B_SERVICE_TYPES — cast via never since we're
      // deliberately testing the happy-path guard (set membership check).
      serviceType: 'UNKNOWN' as unknown as DE13bServiceType,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });

  it('DE → DE without serviceType → NOT §13b (service type is required)', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });

  it('DE → DE + §13b serviceType but NOT B2B → B2C short-circuit wins', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: false,
      serviceType: 'GOLD',
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });
});

describe('reverse-charge.service — DE_13B_SERVICE_TYPES membership', () => {
  it('exports exactly 5 service types', () => {
    expect(DE_13B_SERVICE_TYPES.size).toBe(5);
  });

  it('includes CONSTRUCTION, CLEANING_BUILDING, SCRAP_METALS, GOLD, MOBILE_PHONES', () => {
    expect(DE_13B_SERVICE_TYPES.has('CONSTRUCTION')).toBe(true);
    expect(DE_13B_SERVICE_TYPES.has('CLEANING_BUILDING')).toBe(true);
    expect(DE_13B_SERVICE_TYPES.has('SCRAP_METALS')).toBe(true);
    expect(DE_13B_SERVICE_TYPES.has('GOLD')).toBe(true);
    expect(DE_13B_SERVICE_TYPES.has('MOBILE_PHONES')).toBe(true);
  });
});

describe('reverse-charge.service — regression (existing rules still pass)', () => {
  it('EU cross-border B2B (DE → FR) with buyer VAT ID → eu_cross_border_b2b', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'FR',
      buyerHasVatId: true,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(true);
    expect(out.rule).toBe('eu_cross_border_b2b');
  });

  it('EU cross-border B2B without buyer VAT ID → not_applicable', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'FR',
      buyerHasVatId: false,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });

  it('Domestic DE → DE with no serviceType → not_applicable (no RC)', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      buyerHasVatId: true,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });

  it('B2C cross-border → not_applicable', () => {
    const out = detectReverseCharge({
      sellerCountry: 'DE',
      buyerCountry: 'FR',
      buyerHasVatId: false,
      isB2B: false,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });

  it('GCC cross-border (AE → SA) → not_applicable', () => {
    const out = detectReverseCharge({
      sellerCountry: 'AE',
      buyerCountry: 'SA',
      buyerHasVatId: true,
      isB2B: true,
    });
    expect(out.shouldApply).toBe(false);
    expect(out.rule).toBe('not_applicable');
  });
});
