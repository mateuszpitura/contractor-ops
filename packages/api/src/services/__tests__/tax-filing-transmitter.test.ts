// Tax-filing transmitter factory + per-state output.
//
// Locks the factory selection (ManualDownload default; IrisA2A only when
// module.iris-efile is enabled; Vendor a never-selected stub), the flag-defer
// safety of the manual pipeline (no XSD bundle -> BUNDLE_UNAVAILABLE, never
// throws, never ready), and the per-state CFSF vs direct-filing output.

import { describe, expect, it, vi } from 'vitest';

const irisEfileEnabled = { value: false };

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn((flag: string) => ({
    enabled: flag === 'module.iris-efile' ? irisEfileEnabled.value : false,
    reason: 'test',
  })),
}));

import type { StateFilingRecipient } from '../state-filing-output';
import { buildStateFilingOutput } from '../state-filing-output';
import { createTaxFilingTransmitter, selectTaxFilingTransmitter } from '../tax-filing-transmitter';

const flagCtx = { organizationId: 'org-a', region: 'EU' as const };

const irisInput = {
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
};

describe('tax-filing-transmitter — factory selection', () => {
  it('selects ManualDownload by default (no TCC, GA path)', () => {
    irisEfileEnabled.value = false;
    expect(selectTaxFilingTransmitter(flagCtx).method).toBe('manual');
  });

  it('selects IrisA2A only when module.iris-efile is enabled', () => {
    irisEfileEnabled.value = true;
    expect(selectTaxFilingTransmitter(flagCtx).method).toBe('iris-a2a');
    irisEfileEnabled.value = false;
    expect(selectTaxFilingTransmitter(flagCtx).method).toBe('manual');
  });

  it('keeps Vendor as a stub seam (not selected by the default path)', async () => {
    const vendor = createTaxFilingTransmitter('vendor');
    expect(vendor.method).toBe('vendor');
    await expect(vendor.transmit()).rejects.toThrow(/not configured/i);
  });
});

describe('tax-filing-transmitter — ManualDownload pipeline (flag-defer safe)', () => {
  it('reports BUNDLE_UNAVAILABLE and is not ready while the XSD bundle is absent (never throws)', async () => {
    irisEfileEnabled.value = false;
    const manual = selectTaxFilingTransmitter(flagCtx);
    const result = await manual.transmit(irisInput);

    expect(result.method).toBe('manual');
    // Pre-enablement: the XSD bundle is not present, so validity is unproven —
    // no downloadable XML, and the pipeline never crashes. Auto-flips to VALID +
    // ready once the IRS XSD bundle lands (asserted in packages/iris).
    expect(result.validation.status).toBe('BUNDLE_UNAVAILABLE');
    expect(result.ready).toBe(false);
    expect(result.xml).toBeUndefined();
  });
});

describe('state-filing-output — CFSF vs direct-filing', () => {
  const recipients: StateFilingRecipient[] = [
    {
      recipientId: 'r1',
      recipientName: 'Jane, Q. Contractor',
      recipientTinLast4: '1120',
      box1AmountMinor: 250_000,
      box4BackupWithholdingMinor: 0,
      stateWithholdingMinor: 5_000,
    },
  ];

  it('CFSF participant is auto-forwarded via the B-record — no separate file', () => {
    const out = buildStateFilingOutput(
      { stateCode: 'GA', cfsfParticipant: true, requiresDirectFiling: false },
      recipients,
    );
    expect(out.cfsfHandled).toBe(true);
    expect(out.csv).toBeNull();
    expect(out.guidance).toMatch(/Combined Federal\/State Filing/);
  });

  it('a direct-filing state (Maryland) emits a per-state CSV + manual guidance', () => {
    const out = buildStateFilingOutput(
      { stateCode: 'MD', cfsfParticipant: true, requiresDirectFiling: true, note: 'direct-file' },
      recipients,
    );
    expect(out.cfsfHandled).toBe(false);
    expect(out.csv).not.toBeNull();
    // Header + one recipient row; the recipient name with a comma is CSV-quoted.
    expect(out.csv).toContain('Box1NonemployeeCompensationUSD');
    expect(out.csv).toContain('"Jane, Q. Contractor"');
    expect(out.csv).toContain('2500.00');
    expect(out.guidance).toMatch(/requires direct state filing/i);
  });

  it('a non-CFSF state emits a CSV too', () => {
    const out = buildStateFilingOutput(
      { stateCode: 'PA', cfsfParticipant: false, requiresDirectFiling: true },
      recipients,
    );
    expect(out.cfsfHandled).toBe(false);
    expect(out.csv).not.toBeNull();
  });
});
