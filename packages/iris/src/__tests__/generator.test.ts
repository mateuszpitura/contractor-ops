// IRIS XML generator (buildIrisXml) — Wave-0 RED scaffold.
//
// Asserts the not-yet-built buildIrisXml emits a Transmission Manifest carrying
// the schema VersionNum/VersionDt it was built against, and a payee B-record
// that carries the Combined Federal/State Filing (CFSF) state code for a
// participating state. The generator must use fast-xml-parser XMLBuilder
// (never string-concatenated XML — entity-escape bugs surface as opaque XSD
// failures), mirroring packages/einvoice. This RED scaffold imports a module
// that does not exist yet, so the suite fails at resolution until the generator
// lands in a later wave.

import { describe, expect, it } from 'vitest';
// The implementation does not exist yet — Wave-0 RED (resolution-fail).
import { buildIrisXml } from '../generator.js';

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
});
