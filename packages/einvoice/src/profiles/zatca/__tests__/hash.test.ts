import { describe, expect, it } from 'vitest';
import type { EInvoice } from '../../../types/invoice.js';
import { generateZatcaXml } from '../generator.js';
import { computeZatcaInvoiceHash } from '../hash.js';

function sampleInvoice(): EInvoice {
  return {
    id: 'INV-1001',
    issueDate: '2026-07-08',
    invoiceTypeCode: '388',
    currencyCode: 'SAR',
    supplier: { id: '300000000000003', name: 'Acme KSA', country: 'SA' },
    customer: { id: '300000000000004', name: 'Buyer Co', country: 'SA' },
    lines: [
      {
        lineNumber: 1,
        description: 'Consulting',
        quantity: 1,
        unitPriceMinor: 10_000,
        netAmountMinor: 10_000,
        vatRate: '15.00',
        vatAmountMinor: 1_500,
        grossAmountMinor: 11_500,
      },
    ],
    taxExclusiveAmount: 10_000,
    taxInclusiveAmount: 11_500,
    payableAmount: 11_500,
    taxBreakdown: [
      {
        taxableAmountMinor: 10_000,
        taxAmountMinor: 1_500,
        taxCategory: 'S',
        percent: 15,
      },
    ],
    profileId: 'zatca',
    extensions: {
      icv: 1,
      pih: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      invoiceSubtype: '0100000',
      invoiceType: 'standard',
    },
  };
}

describe('computeZatcaInvoiceHash', () => {
  it('returns base64 and hex digests of canonicalized XML without extensions/QR', async () => {
    const xml = await generateZatcaXml(sampleInvoice());
    const hash = computeZatcaInvoiceHash(xml);

    expect(hash.hex).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(hash.hex, 'hex').toString('base64')).toBe(hash.base64);
  });

  it('is stable for the same unsigned XML input', async () => {
    const xml = await generateZatcaXml(sampleInvoice());
    const a = computeZatcaInvoiceHash(xml);
    const b = computeZatcaInvoiceHash(xml);
    expect(a).toEqual(b);
  });

  it('differs when invoice content changes', async () => {
    const base = sampleInvoice();
    const changed = { ...base, id: 'INV-1002' };
    const h1 = computeZatcaInvoiceHash(await generateZatcaXml(base));
    const h2 = computeZatcaInvoiceHash(await generateZatcaXml(changed));
    expect(h1.hex).not.toBe(h2.hex);
  });
  // ZATCA spec references XML C14N 1.1 (http://www.w3.org/TR/2001/REC-xml-c14n-20010315).
  // This implementation uses Exclusive C14N (xml-crypto ExclusiveCanonicalization) — the
  // same transform wired into the XAdES signer — because no official ZATCA known-answer
  // vector is available offline in-repo. Exclusive vs inclusive C14N 1.1 can diverge on
  // namespace/default-attribute edge cases; treat clearance hash mismatches there as a
  // canonicalization gap, not a SHA-256 wiring bug.
  it('pins a regression vector for the sample invoice fixture (C-21)', async () => {
    const xml = await generateZatcaXml(sampleInvoice());
    const hash = computeZatcaInvoiceHash(xml);

    expect(hash.hex).toBe('e486241c182779eee8c42222c22b31d7e51d3744b17122c07852a65b1cb4ef1f');
    expect(Buffer.from(hash.hex, 'hex').toString('base64')).toBe(hash.base64);
  });

  it('excludes UBLExtensions and QR AdditionalDocumentReference from the digest basis', async () => {
    const xml = await generateZatcaXml(sampleInvoice());
    const withNoise = xml.replace(
      '</cbc:ProfileID>',
      '</cbc:ProfileID><ext:UBLExtensions><ext:UBLExtension/></ext:UBLExtensions>',
    );

    const base = computeZatcaInvoiceHash(xml);
    const noisy = computeZatcaInvoiceHash(withNoise);
    expect(noisy.hex).toBe(base.hex);
  });
});
