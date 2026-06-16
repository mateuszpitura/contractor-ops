// IRIS XSD validator (xsdValidate) — Wave-0 RED scaffold.
//
// Asserts the not-yet-built xsdValidate round-trips a buildIrisXml golden output
// through libxmljs2 against the bundled IRS IRIS XSD and reports VALID, while an
// XSD-invalid document reports INVALID with per-error detail (mirroring the
// packages/einvoice KoSIT layer-1 ValidationReport shape). The validator must be
// SSRF/XXE-safe ({ nonet: true }, default noent:false) and resolve the bundle
// dir lazily. This RED scaffold imports modules that do not exist yet, so the
// suite fails at resolution until generator + validator + the bundled XSDs land.

import { describe, expect, it } from 'vitest';
// The implementations do not exist yet — Wave-0 RED (resolution-fail).
import { buildIrisXml } from '../generator';
import { xsdValidate } from '../validator';

const goldenInput = {
  taxYear: 2026 as const,
  schemaVersion: { versionNum: '2.0', versionDt: '2025-11-06' },
  payer: { tin: '123456789', name: 'Acme Org', stateCode: 'CA' },
  payees: [
    {
      recipientTin: 'XXX-XX-1120',
      recipientName: 'Jane Q. Contractor',
      box1AmountMinor: 250_000,
      box4BackupWithholdingMinor: 0,
      cfsfStateCode: 'CA',
    },
  ],
};

describe('xsdValidate — IRIS XML against bundled IRS XSD (US-FORM-05)', () => {
  it('returns VALID for a buildIrisXml golden output', async () => {
    const xml = buildIrisXml(goldenInput);

    const report = await xsdValidate(xml);

    expect(report.status).toBe('VALID');
    expect(report.errors).toEqual([]);
  });

  it('returns INVALID with per-error detail for a structurally-broken document', async () => {
    const report = await xsdValidate('<Submission><Unexpected/></Submission>');

    expect(report.status).toBe('INVALID');
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it('never fetches an external schema (nonet) — validation does not throw on a bad instance', async () => {
    await expect(xsdValidate('<not-iris/>')).resolves.toBeDefined();
  });
});
