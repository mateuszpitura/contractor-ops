// Phase 57 · Plan 03 · Task 3 — kleinunternehmer.service.
//
// § 19 UStG small-business VAT exemption:
//   - When org.countryCode='DE' AND org.isKleinunternehmer=true:
//       • every non-RC invoice line forced to vatRate='KU' (0% exempt)
//       • invoice footer renders TAX_KLEINUNTERNEHMER_NOTICE (Plan 57-04)
//       • VAT totals breakdown suppressed (RESEARCH Pitfall 7)
//   - RC (reverse charge) takes PRECEDENCE over KU — legal attribution
//     beats small-business exemption.

import { describe, expect, it } from 'vitest';

import {
  applyKleinunternehmerOverride,
  shouldSuppressVatBreakdown,
} from '../kleinunternehmer.service.js';

describe('applyKleinunternehmerOverride', () => {
  it('DE org + isKleinunternehmer=true + vatRate=19 → forces KU with §19 reason', () => {
    const out = applyKleinunternehmerOverride(
      { vatRate: '19', description: 'Services' },
      { countryCode: 'DE', isKleinunternehmer: true },
    );
    expect(out).toEqual({
      vatRate: 'KU',
      forced: true,
      reason: '§19 UStG Kleinunternehmerregelung',
    });
  });

  it('DE org + isKleinunternehmer=false → passthrough (no force)', () => {
    const out = applyKleinunternehmerOverride(
      { vatRate: '19', description: 'Services' },
      { countryCode: 'DE', isKleinunternehmer: false },
    );
    expect(out.vatRate).toBe('19');
    expect(out.forced).toBe(false);
  });

  it('non-DE country (GB) + isKleinunternehmer=true → flag ignored, passthrough', () => {
    const out = applyKleinunternehmerOverride(
      { vatRate: '20', description: 'Services' },
      { countryCode: 'GB', isKleinunternehmer: true },
    );
    expect(out.vatRate).toBe('20');
    expect(out.forced).toBe(false);
  });

  it('DE org + KU=true + vatRate=RC → RC takes precedence (legal attribution beats exemption)', () => {
    const out = applyKleinunternehmerOverride(
      { vatRate: 'RC', description: '§13b construction' },
      { countryCode: 'DE', isKleinunternehmer: true },
    );
    expect(out).toEqual({
      vatRate: 'RC',
      forced: false,
      reason: 'Reverse charge takes precedence over Kleinunternehmer',
    });
  });

  it('null vatRate + DE + KU=true → empty-string passthrough forced to KU', () => {
    const out = applyKleinunternehmerOverride(
      { vatRate: null, description: 'line with missing rate' },
      { countryCode: 'DE', isKleinunternehmer: true },
    );
    expect(out.vatRate).toBe('KU');
    expect(out.forced).toBe(true);
  });

  it('null countryCode → passthrough (cannot attribute KU without jurisdiction)', () => {
    const out = applyKleinunternehmerOverride(
      { vatRate: '19', description: 'Services' },
      { countryCode: null, isKleinunternehmer: true },
    );
    expect(out.vatRate).toBe('19');
    expect(out.forced).toBe(false);
  });
});

describe('shouldSuppressVatBreakdown', () => {
  it('DE + isKleinunternehmer=true → true (suppress VAT totals)', () => {
    expect(
      shouldSuppressVatBreakdown({
        countryCode: 'DE',
        isKleinunternehmer: true,
      }),
    ).toBe(true);
  });

  it('DE + isKleinunternehmer=false → false', () => {
    expect(
      shouldSuppressVatBreakdown({
        countryCode: 'DE',
        isKleinunternehmer: false,
      }),
    ).toBe(false);
  });

  it('non-DE (PL) + isKleinunternehmer=true → false (wrong country)', () => {
    expect(
      shouldSuppressVatBreakdown({
        countryCode: 'PL',
        isKleinunternehmer: true,
      }),
    ).toBe(false);
  });
});
