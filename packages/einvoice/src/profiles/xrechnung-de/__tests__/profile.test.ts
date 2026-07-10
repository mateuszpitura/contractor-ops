// packages/einvoice/src/profiles/xrechnung-de/__tests__/profile.test.ts
//
// Profile-level wiring lock — BG-20 Skonto forwarding via XRechnungDEProfile.
//
// The XRechnungDEProfile wrapper must forward opts.skontoTerm into
// generateXRechnungCii. This file calls the WRAPPER methods (generate +
// generateAndValidate) on a real XRechnungDEProfile instance and asserts
// the produced XML contains the structured BG-20 string AND that the
// KoSIT 3-layer pipeline is exercised on both with-Skonto and without-Skonto
// branches.
//
// NOTE — leitwegId in the KoSIT-validated calls: the fixtures intentionally
// omit a leitwegId so the same EInvoice envelope drives both branches. KoSIT
// layer 3 (XRechnung CIUS Schematron) requires BR-DE-15 ("Buyer reference
// BT-10 must be provided"), so the VALID assertions pass `leitwegId` at call
// time alongside the Skonto opt. This keeps fixture symmetry and proves the
// wrapper forwards BOTH opts correctly.

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { EInvoice } from '../../../types/invoice.js';
import type { SkontoTermInput } from '../index.js';
import { XRechnungDEProfile } from '../index.js';

async function loadFixture(name: string): Promise<EInvoice> {
  const p = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));
  return JSON.parse(await fs.readFile(p, 'utf-8')) as EInvoice;
}

const SKONTO_TERM: SkontoTermInput = {
  discountPercent: 3,
  discountPeriodDays: 7,
  netPeriodDays: 30,
};

// Sample Leitweg-ID matching the format used by `kosit-positive-leitweg.xml`
// (route-id 04011000 + dash + sub-id + check digit). Required for the KoSIT
// VALID assertions because BR-DE-15 mandates BT-10 BuyerReference presence.
const LEITWEG_ID = '04011000-12345-03';

describe('XRechnungDEProfile — Skonto BG-20 wiring', () => {
  it('forwards opts.skontoTerm into generateXRechnungCii: produced XML contains structured BG-20 #SKONTO# extension', async () => {
    const profile = new XRechnungDEProfile();
    const invoice = await loadFixture('skonto-invoice');

    const xml = await profile.generate(invoice, { skontoTerm: SKONTO_TERM });

    expect(xml).toContain('<ram:SpecifiedTradePaymentTerms>');
    expect(xml).toContain('#SKONTO#TAGE=7');
    expect(xml).toContain('#PROZENT=3.00');
    expect(xml).toContain('#BASISBETRAG=');
  });

  it('omits BG-20 #SKONTO# extension when opts.skontoTerm is null', async () => {
    const profile = new XRechnungDEProfile();
    const invoice = await loadFixture('no-skonto-invoice');

    const xml = await profile.generate(invoice, { skontoTerm: null });

    expect(xml).not.toContain('#SKONTO#');
  });

  it('omits BG-20 #SKONTO# extension when opts is undefined', async () => {
    const profile = new XRechnungDEProfile();
    const invoice = await loadFixture('no-skonto-invoice');

    const xml = await profile.generate(invoice);

    expect(xml).not.toContain('#SKONTO#');
  });

  it('generateAndValidate runs the KoSIT 3-layer pipeline with Skonto', async () => {
    const profile = new XRechnungDEProfile();
    const invoice = await loadFixture('skonto-invoice');

    const { xml, report } = await profile.generateAndValidate(invoice, {
      leitwegId: LEITWEG_ID,
      skontoTerm: SKONTO_TERM,
    });

    // Wiring assertion: Skonto opt forwarded all the way through
    // generateAndValidate → generate → generateXRechnungCii.
    expect(xml).toContain('#SKONTO#TAGE=7');

    // KoSIT pipeline shape lock: all three layers exercised.
    expect(report.layers).toHaveLength(3);
    expect(report.layers.map(l => l.layer)).toEqual(['XSD', 'EN16931-SCH', 'XRECHNUNG-SCH']);
    expect(report.status).toBe('VALID');
  });

  it('generateAndValidate runs the KoSIT 3-layer pipeline without Skonto (no-regression)', async () => {
    const profile = new XRechnungDEProfile();
    const invoice = await loadFixture('no-skonto-invoice');

    const { xml, report } = await profile.generateAndValidate(invoice, {
      leitwegId: LEITWEG_ID,
    });

    expect(xml).not.toContain('#SKONTO#');

    expect(report.layers).toHaveLength(3);
    expect(report.layers.map(l => l.layer)).toEqual(['XSD', 'EN16931-SCH', 'XRECHNUNG-SCH']);
    expect(report.status).toBe('VALID');
  });
});
