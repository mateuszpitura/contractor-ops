import { describe, expect, it } from 'vitest';
import { generateFa3Xml } from '../generator.js';
import { ksefToEInvoice } from '../mapper.js';
import { parseFa3Xml } from '../parser.js';
import type { EInvoice } from '../../../types/invoice.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestInvoice(): EInvoice {
  return {
    id: 'FV/2026/04/001',
    issueDate: '2026-04-11',
    invoiceTypeCode: '380',
    currencyCode: 'PLN',
    supplier: {
      id: '1234567890',
      name: 'Seller Sp. z o.o.',
      address: 'ul. Testowa 1',
      country: 'PL',
    },
    customer: {
      id: '9876543210',
      name: 'Buyer S.A.',
      country: 'PL',
    },
    lines: [
      {
        lineNumber: 1,
        description: 'Development Services',
        quantity: 10,
        unit: 'szt',
        unitPriceMinor: 10000,
        netAmountMinor: 100000,
        vatRate: '23',
        vatAmountMinor: 23000,
      },
    ],
    taxExclusiveAmount: 100000,
    taxInclusiveAmount: 123000,
    payableAmount: 123000,
    taxBreakdown: [
      { taxableAmountMinor: 100000, taxAmountMinor: 23000, taxCategory: 'S', percent: 23 },
    ],
    paymentMeans: {
      dueDate: '2026-05-11',
      bankAccount: 'PL12345678901234567890123456',
    },
    profileId: 'ksef',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseFa3Xml', () => {
  it('parses a generated FA(3) XML roundtrip', () => {
    const xml = generateFa3Xml(createTestInvoice());
    const parsed = parseFa3Xml(xml, 'KSeF-REF-001', 'UPO-001');

    expect(parsed.invoiceNumber).toBe('FV/2026/04/001');
    expect(parsed.issueDate).toBe('2026-04-11');
    expect(parsed.invoiceType).toBe('VAT');
    expect(parsed.currency).toBe('PLN');
    expect(parsed.ksefReferenceNumber).toBe('KSeF-REF-001');
    expect(parsed.upoNumber).toBe('UPO-001');
  });

  it('parses seller information', () => {
    const xml = generateFa3Xml(createTestInvoice());
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.seller.nip).toBe('1234567890');
    expect(parsed.seller.name).toBe('Seller Sp. z o.o.');
    expect(parsed.seller.address).toContain('Testowa');
  });

  it('parses buyer information', () => {
    const xml = generateFa3Xml(createTestInvoice());
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.buyer.nip).toBe('9876543210');
    expect(parsed.buyer.name).toBe('Buyer S.A.');
  });

  it('parses line items with monetary amounts in minor units', () => {
    const xml = generateFa3Xml(createTestInvoice());
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.lines).toHaveLength(1);
    const line = parsed.lines[0]!;
    expect(line.lineNumber).toBe(1);
    expect(line.description).toBe('Development Services');
    expect(line.quantity).toBe(10);
    expect(line.unit).toBe('szt');
    expect(line.unitPriceMinor).toBe(10000);
    expect(line.netAmountMinor).toBe(100000);
    expect(line.vatRate).toBe('23');
    expect(line.vatAmountMinor).toBe(23000);
    expect(line.grossAmountMinor).toBe(123000);
  });

  it('parses totals', () => {
    const xml = generateFa3Xml(createTestInvoice());
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.totals.netMinor).toBe(100000);
    expect(parsed.totals.vatMinor).toBe(23000);
    expect(parsed.totals.grossMinor).toBe(123000);
  });

  it('parses payment information', () => {
    const xml = generateFa3Xml(createTestInvoice());
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.payment?.dueDate).toBe('2026-05-11');
    expect(parsed.payment?.bankAccount).toBe('PL12345678901234567890123456');
  });

  it('handles missing payment section', () => {
    const invoice = createTestInvoice();
    invoice.paymentMeans = undefined;
    const xml = generateFa3Xml(invoice);
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.payment).toBeUndefined();
  });

  it('full roundtrip: generate -> parse -> ksefToEInvoice preserves key fields', () => {
    const original = createTestInvoice();
    const xml = generateFa3Xml(original);
    const parsed = parseFa3Xml(xml, 'KSeF-REF');
    const einvoice = ksefToEInvoice(parsed);

    expect(einvoice.id).toBe(original.id);
    expect(einvoice.issueDate).toBe(original.issueDate);
    expect(einvoice.currencyCode).toBe(original.currencyCode);
    expect(einvoice.supplier.id).toBe(original.supplier.id);
    expect(einvoice.supplier.name).toBe(original.supplier.name);
    expect(einvoice.customer.id).toBe('9876543210');
    expect(einvoice.taxExclusiveAmount).toBe(original.taxExclusiveAmount);
    expect(einvoice.taxInclusiveAmount).toBe(original.taxInclusiveAmount);
    expect(einvoice.profileId).toBe('ksef');
  });

  it('parses invoice with multiple lines', () => {
    const invoice = createTestInvoice();
    invoice.lines = [
      {
        lineNumber: 1,
        description: 'Service A',
        netAmountMinor: 50000,
        vatRate: '23',
        vatAmountMinor: 11500,
      },
      {
        lineNumber: 2,
        description: 'Service B',
        quantity: 5,
        unit: 'szt',
        netAmountMinor: 50000,
        vatRate: '23',
        vatAmountMinor: 11500,
      },
    ];
    const xml = generateFa3Xml(invoice);
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]?.description).toBe('Service A');
    expect(parsed.lines[1]?.description).toBe('Service B');
    expect(parsed.lines[1]?.quantity).toBe(5);
  });

  it('handles corrective invoice type (KOR)', () => {
    const invoice = createTestInvoice();
    invoice.invoiceTypeCode = '381';
    const xml = generateFa3Xml(invoice);
    const parsed = parseFa3Xml(xml, 'ref');

    expect(parsed.invoiceType).toBe('KOR');
  });

  it('throws ZodError for invalid parsed structure', () => {
    // XML with missing required Fa section (empty Faktura)
    const badXml = '<Faktura><Podmiot1><DaneIdentyfikacyjne><NIP>123</NIP><Nazwa>X</Nazwa></DaneIdentyfikacyjne></Podmiot1></Faktura>';

    expect(() => parseFa3Xml(badXml, 'ref')).toThrow();
  });
});
