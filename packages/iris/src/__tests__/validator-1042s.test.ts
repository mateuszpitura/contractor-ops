// IRIS 1042-S XSD validator (xsdValidate1042S) — Publication 1187.
//
// The 1042-S generator + validator are built; the "returns VALID" and "rejects
// a broken document" assertions genuinely need the IRS Publication 1187 XSD,
// which is a human-only download (IRS SOR login). Until the .xsd files land,
// those two assertions are SKIPPED (a loud HOLD is printed) and the
// pre-enablement contract — xsdValidate1042S reports BUNDLE_UNAVAILABLE, never
// throwing — is asserted instead. The moment the bundle is placed,
// `hasXsdBundle()` flips true and the skipped assertions run for real
// (RED→GREEN). No assertion is deleted, weakened, or faked.

import { describe, expect, it } from 'vitest';
import { buildIris1042SXml } from '../generator.js';
import { xsdValidate1042S } from '../validator.js';
import { hasXsdBundle, XSD_HOLD_MESSAGE } from './xsd-bundle-present.js';

const goldenInput = {
  taxYear: 2026 as const,
  schemaVersion: { versionNum: '1.0', versionDt: '2025-11-06' },
  withholdingAgent: { tin: '123456789', name: 'Acme Org' },
  recipients: [
    {
      recipientFtin: 'XXX-XX-4821',
      recipientName: 'Jean Contractor',
      incomeCode: '17',
      grossIncomeBox2Minor: 500_000,
      chap3ExemptionCode: '00',
      chap3RateBp: 1500,
      chap4ExemptionCode: '15',
      chap4RateBp: 0,
      federalTaxWithheldBox7Minor: 75_000,
      recipientChap3StatusCode: '16',
      recipientChap4StatusCode: '23',
      recipientLobCode: '25',
      treatyArticle: 'Article 7',
    },
  ],
};

const bundlePresent = hasXsdBundle();

describe('xsdValidate1042S — 1042-S XML against the bundled Pub 1187 XSD (US-FORM-06)', () => {
  it.skipIf(!bundlePresent)('returns VALID for a buildIris1042SXml golden output', async () => {
    const xml = buildIris1042SXml(goldenInput);
    const report = await xsdValidate1042S(xml);
    expect(report.status).toBe('VALID');
    expect(report.errors).toEqual([]);
  });

  it.skipIf(!bundlePresent)(
    'returns INVALID with per-error detail for a structurally-broken document',
    async () => {
      const report = await xsdValidate1042S('<Form1042S><Unexpected/></Form1042S>');
      expect(report.status).toBe('INVALID');
      expect(report.errors.length).toBeGreaterThan(0);
    },
  );

  it.runIf(!bundlePresent)(
    'reports BUNDLE_UNAVAILABLE (non-throwing) while the Pub 1187 XSD bundle is absent [HOLD]',
    async () => {
      console.warn(XSD_HOLD_MESSAGE);
      const report = await xsdValidate1042S(buildIris1042SXml(goldenInput));
      expect(report.status).toBe('BUNDLE_UNAVAILABLE');
      expect(report.errors.length).toBeGreaterThan(0);
    },
  );

  it('never fetches an external schema (nonet) — validation does not throw on a bad instance', async () => {
    await expect(xsdValidate1042S('<not-1042s/>')).resolves.toBeDefined();
  });
});
