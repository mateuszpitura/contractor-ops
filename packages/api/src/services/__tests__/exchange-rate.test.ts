import { describe, expect, it } from 'vitest';
import { deriveAedRate, deriveSarRate, parseEcbXml } from '../exchange-rate.js';

// Sample ECB XML fragment for testing
const SAMPLE_ECB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
  xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time="2026-04-11">
      <Cube currency="USD" rate="1.0836"/>
      <Cube currency="GBP" rate="0.85630"/>
      <Cube currency="PLN" rate="4.2815"/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe('parseEcbXml', () => {
  it('extracts USD, GBP, PLN rates from sample ECB XML', () => {
    const rates = parseEcbXml(SAMPLE_ECB_XML);
    expect(rates.get('USD')).toBeCloseTo(1.0836, 4);
    expect(rates.get('GBP')).toBeCloseTo(0.8563, 4);
    expect(rates.get('PLN')).toBeCloseTo(4.2815, 4);
    expect(rates.size).toBe(3);
  });

  it('returns empty map for malformed XML', () => {
    const rates = parseEcbXml('<invalid>not xml rates</invalid>');
    expect(rates.size).toBe(0);
  });

  it('returns empty map for empty string', () => {
    const rates = parseEcbXml('');
    expect(rates.size).toBe(0);
  });

  it('handles single-quote XML attributes', () => {
    const xml = `<Cube currency='EUR' rate='1.0000'/><Cube currency='CHF' rate='0.9321'/>`;
    const rates = parseEcbXml(xml);
    expect(rates.get('CHF')).toBeCloseTo(0.9321, 4);
  });
});

describe('deriveAedRate', () => {
  it('computes AED/EUR as USD/EUR * 3.6725', () => {
    const usdPerEur = 1.0836;
    const aedRate = deriveAedRate(usdPerEur);
    expect(aedRate).not.toBeNull();
    expect(aedRate).toBeCloseTo(usdPerEur * 3.6725, 4);
  });

  it('returns null when USD rate is undefined', () => {
    expect(deriveAedRate(undefined)).toBeNull();
  });

  it('returns null when USD rate is 0', () => {
    expect(deriveAedRate(0)).toBeNull();
  });

  it('returns null when USD rate is negative', () => {
    expect(deriveAedRate(-1)).toBeNull();
  });
});

describe('deriveSarRate', () => {
  it('computes SAR/EUR as USD/EUR * 3.75', () => {
    const usdPerEur = 1.0836;
    const sarRate = deriveSarRate(usdPerEur);
    expect(sarRate).not.toBeNull();
    expect(sarRate).toBeCloseTo(usdPerEur * 3.75, 4);
  });

  it('returns null when USD rate is undefined', () => {
    expect(deriveSarRate(undefined)).toBeNull();
  });
});
