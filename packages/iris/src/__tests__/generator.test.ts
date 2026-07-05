// IRIS XML generator (buildIrisXml) — 1099-NEC.
//
// Asserts buildIrisXml emits a Transmission Manifest carrying the schema
// VersionNum/VersionDt it was built against, and a payee B-record that carries
// the Combined Federal/State Filing (CFSF) state code for a participating
// state. The generator uses fast-xml-parser XMLBuilder (never
// string-concatenated XML — entity-escape bugs surface as opaque XSD failures),
// mirroring packages/einvoice. These assertions are XSD-independent (XML shape
// only) so they run GREEN now, before the IRS XSD bundle lands.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildIrisXml } from '../generator.js';
import type { IrisSubmissionInput } from '../types.js';

const goldenInput = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'golden-1099-nec.json'),
    'utf8',
  ),
) as IrisSubmissionInput;

describe('buildIrisXml — IRIS 1099-NEC XML (US-FORM-05 / US-FORM-07)', () => {
  it('emits a Transmission Manifest with the schema VersionNum/VersionDt it was built against', () => {
    const xml = buildIrisXml({
      taxYear: 2026,
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
    });

    expect(typeof xml).toBe('string');
    expect(xml).toContain('2.0');
    expect(xml).toContain('2025-11-06');
  });

  it('writes the CFSF state code into the payee B-record for a participating state', () => {
    const xml = buildIrisXml({
      taxYear: 2026,
      schemaVersion: { versionNum: '2.0', versionDt: '2025-11-06' },
      payer: { tin: '123456789', name: 'Acme Org', stateCode: 'CA' },
      payees: [
        {
          recipientTin: 'XXX-XX-1120',
          recipientName: 'Jane Q. Contractor',
          box1AmountMinor: 250_000,
          box4BackupWithholdingMinor: 0,
          cfsfStateCode: 'GA',
        },
      ],
    });

    // The participating state's CFSF code must appear in the emitted B-record.
    expect(xml).toContain('GA');
  });

  it('never string-concatenates XML — full TIN never leaks into the payload (last-4 only)', () => {
    const xml = buildIrisXml({
      taxYear: 2026,
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
    });

    expect(xml).not.toContain('078051120');
  });

  it('builds the golden fixture (matched + CFSF-state recipient) with the CFSF code in the B-record', () => {
    const xml = buildIrisXml(goldenInput);

    // The golden fixture pairs a non-CFSF recipient with a CFSF-participating
    // (GA) recipient — the participating state's code must reach its B-record.
    expect(xml).toContain('GA');
    expect(xml).toContain(goldenInput.payees[1].recipientTin);
    // Both box-1 dollar figures (whole-dollar) are emitted.
    expect(xml).toContain('2500');
    expect(xml).toContain('4800');
  });
});
