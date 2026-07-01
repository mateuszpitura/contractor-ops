// IRIS 1042-S XML generator (buildIris1042SXml) — Wave-0 RED scaffold.
//
// The 1042-S is a separate IRS schema (Publication 1187) from the 1099 series, so
// it gets its own sibling builder rather than a parameterised 1099 builder — the
// record layout differs materially (chapter 3/4 status codes, income codes,
// treaty fields). This scaffold imports a `buildIris1042SXml` that does not exist
// yet, so the suite fails at resolution until the generator lands in a later wave
// (and until the Pub 1187 XSD is bundled + pinned).
//
// The builder must emit a Transmission Manifest carrying the schema version it
// was built against, write a 1042-S payee record with the box fields, use the
// fast-xml-parser XMLBuilder (never string-concatenated XML — entity-escape bugs
// surface as opaque XSD failures), and never leak a full foreign TIN (last-4
// only).

import { describe, expect, it } from 'vitest';
// The implementation does not exist yet — Wave-0 RED (resolution-fail).
import { buildIris1042SXml } from '../generator.js';

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

describe('buildIris1042SXml — IRIS 1042-S XML (US-FORM-06)', () => {
  it('emits a Transmission Manifest with the schema version it was built against', () => {
    const xml = buildIris1042SXml(goldenInput);
    expect(typeof xml).toBe('string');
    expect(xml).toContain('1.0');
    expect(xml).toContain('2025-11-06');
  });

  it('writes the 1042-S box fields into the payee record (income code, box 2, ch3/ch4, box 7, treaty article)', () => {
    const xml = buildIris1042SXml(goldenInput);
    expect(xml).toContain('17'); // income code
    expect(xml).toContain('Article 7'); // treaty article
    expect(xml).toContain('16'); // recipient chapter-3 status (13j)
    expect(xml).toContain('23'); // recipient chapter-4 status (13k)
    expect(xml).toContain('25'); // limitation-on-benefits code (13n)
  });

  it('never string-concatenates XML — a full FTIN never leaks (last-4 only)', () => {
    const xml = buildIris1042SXml(goldenInput);
    expect(xml).not.toContain('999004821');
  });
});
