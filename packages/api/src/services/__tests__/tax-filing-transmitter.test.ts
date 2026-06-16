// tax-filing-transmitter — Wave-0 RED scaffold (US-FORM-05).
//
// A format-factory transmitter seam mirroring the payment-export factory: one
// generation pipeline, swappable transmit tail (D-03). The factory must select
// ManualDownload by default (the TCC-independent GA path, D-01) and only select
// IrisA2A when module.iris-efile is enabled (D-02 — built but dark). Vendor is a
// stub seam.
//
// The factory does not exist yet, so this suite fails at module resolution —
// terminal-RED accepted for Wave 0.

import { describe, expect, it } from 'vitest';
// The implementation does not exist yet — Wave-0 RED (resolution-fail).
import { selectTaxFilingTransmitter } from '../tax-filing-transmitter';

describe('tax-filing-transmitter — factory selection (US-FORM-05 / D-03)', () => {
  it('selects ManualDownload by default (no TCC, GA path)', () => {
    const transmitter = selectTaxFilingTransmitter({ irisA2aEnabled: false });

    expect(transmitter.kind).toBe('manual-download');
  });

  it('selects IrisA2A only when module.iris-efile is enabled', () => {
    const transmitter = selectTaxFilingTransmitter({ irisA2aEnabled: true });

    expect(transmitter.kind).toBe('iris-a2a');
  });

  it('keeps Vendor as a stub seam (not selected by the default path)', () => {
    const transmitter = selectTaxFilingTransmitter({ irisA2aEnabled: false });

    expect(transmitter.kind).not.toBe('vendor');
  });
});
