// IRIS 1042-S XSD validator (xsdValidate1042S) — Wave-0 RED scaffold.
//
// Asserts the not-yet-built 1042-S validator round-trips a buildIris1042SXml
// golden output through libxmljs2 against the bundled IRS 1042-S XSD
// (Publication 1187) and reports VALID, while an XSD-invalid document reports
// INVALID with per-error detail. The validator must be SSRF/XXE-safe
// (`{ nonet: true }`, default `noent: false`) so no external
// `<xs:import schemaLocation="http://...">` is ever fetched and no external
// entity is expanded.
//
// TODO(blocked): this suite stays RED until the IRS Publication 1187 1042-S XSD
// is downloaded from the IRS Secure Object Repository, placed in the iris
// schema-bundle, and checksum-pinned — that download is IRS-login-only and
// cannot be automated. Until then the 1042-S validator cannot be built GREEN.
//
// This scaffold imports modules that do not exist yet, so the suite fails at
// resolution until the generator + the 1042-S validator + the bundled XSD land.

import { describe, expect, it } from 'vitest';
// The implementations do not exist yet — Wave-0 RED (resolution-fail).
import { buildIris1042SXml } from '../generator.js';
import { xsdValidate1042S } from '../validator.js';

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

describe('xsdValidate1042S — 1042-S XML against the bundled Pub 1187 XSD (US-FORM-06)', () => {
  it('returns VALID for a buildIris1042SXml golden output', async () => {
    const xml = buildIris1042SXml(goldenInput);
    const report = await xsdValidate1042S(xml);
    expect(report.status).toBe('VALID');
    expect(report.errors).toEqual([]);
  });

  it('returns INVALID with per-error detail for a structurally-broken document', async () => {
    const report = await xsdValidate1042S('<Form1042S><Unexpected/></Form1042S>');
    expect(report.status).toBe('INVALID');
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it('never fetches an external schema (nonet) — validation does not throw on a bad instance', async () => {
    await expect(xsdValidate1042S('<not-1042s/>')).resolves.toBeDefined();
  });
});
