import { describe, expect, it } from 'vitest';
import type { KsefParsedInvoice } from '../schemas.js';
import { ksefToEInvoice, mapKsefToInvoiceFields } from '../mapper.js';

// ---------------------------------------------------------------------------
// Test Fixture
// ---------------------------------------------------------------------------

function createParsedInvoice(overrides?: Partial<KsefParsedInvoice>): KsefParsedInvoice {
  return {
    invoiceNumber: 'FV/2026/04/001',
    issueDate: '2026-04-11',
    invoiceType: 'VAT',
    currency: 'PLN',
    seller: { nip: '1234567890', name: 'Seller Sp. z o.o.', address: 'ul. Testowa 1' },
    buyer: { nip: '0987654321', name: 'Buyer S.A.' },
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
        grossAmountMinor: 123000,
      },
    ],
    totals: { netMinor: 100000, vatMinor: 23000, grossMinor: 123000 },
    payment: { dueDate: '2026-05-11', bankAccount: 'PL1234', method: 'PRZELEW' },
    ksefReferenceNumber: 'KSeF-REF-001',
    upoNumber: 'UPO-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mapKsefToInvoiceFields
// ---------------------------------------------------------------------------

describe('mapKsefToInvoiceFields', () => {
  it('maps basic invoice fields', () => {
    const { invoice } = mapKsefToInvoiceFields(createParsedInvoice());
    expect(invoice.invoiceNumber).toBe('FV/2026/04/001');
    expect(invoice.source).toBe('KSEF');
    expect(invoice.currency).toBe('PLN');
    expect(invoice.sellerTaxId).toBe('1234567890');
    expect(invoice.sellerName).toBe('Seller Sp. z o.o.');
    expect(invoice.buyerTaxId).toBe('0987654321');
  });

  it('maps monetary totals', () => {
    const { invoice } = mapKsefToInvoiceFields(createParsedInvoice());
    expect(invoice.subtotalMinor).toBe(100000);
    expect(invoice.vatAmountMinor).toBe(23000);
    expect(invoice.totalMinor).toBe(123000);
    expect(invoice.amountToPayMinor).toBe(123000);
  });

  it('maps external reference and UPO', () => {
    const { invoice } = mapKsefToInvoiceFields(createParsedInvoice());
    expect(invoice.externalInvoiceId).toBe('KSeF-REF-001');
    expect(invoice.sourceReference).toBe('UPO-001');
  });

  it('maps payment fields', () => {
    const { invoice } = mapKsefToInvoiceFields(createParsedInvoice());
    expect(invoice.dueDate).toEqual(new Date('2026-05-11'));
    expect(invoice.sellerBankAccount).toBe('PL1234');
  });

  it('handles missing payment', () => {
    const { invoice } = mapKsefToInvoiceFields(createParsedInvoice({ payment: undefined }));
    expect(invoice.dueDate).toBeNull();
    expect(invoice.sellerBankAccount).toBeNull();
  });

  it('handles missing UPO number', () => {
    const { invoice } = mapKsefToInvoiceFields(createParsedInvoice({ upoNumber: undefined }));
    expect(invoice.sourceReference).toBeNull();
  });

  it('derives primary VAT rate from most common line rate', () => {
    const parsed = createParsedInvoice({
      lines: [
        { lineNumber: 1, description: 'A', vatRate: '23', netAmountMinor: 100 },
        { lineNumber: 2, description: 'B', vatRate: '23', netAmountMinor: 200 },
        { lineNumber: 3, description: 'C', vatRate: '8', netAmountMinor: 50 },
      ],
    });
    const { invoice } = mapKsefToInvoiceFields(parsed);
    expect(invoice.vatRate).toBe('23');
  });

  it('returns null vatRate when no lines have vatRate', () => {
    const parsed = createParsedInvoice({
      lines: [{ lineNumber: 1, description: 'A' }],
    });
    const { invoice } = mapKsefToInvoiceFields(parsed);
    expect(invoice.vatRate).toBeNull();
  });

  it('maps line items', () => {
    const { lines } = mapKsefToInvoiceFields(createParsedInvoice());
    expect(lines).toHaveLength(1);
    expect(lines[0]?.lineNumber).toBe(1);
    expect(lines[0]?.description).toBe('Development Services');
    expect(lines[0]?.quantity).toBe(10);
    expect(lines[0]?.unit).toBe('szt');
    expect(lines[0]?.netAmountMinor).toBe(100000);
    expect(lines[0]?.vatRate).toBe('23');
  });

  it('maps lines with optional fields as null', () => {
    const parsed = createParsedInvoice({
      lines: [{ lineNumber: 1, description: 'Service' }],
    });
    const { lines } = mapKsefToInvoiceFields(parsed);
    expect(lines[0]?.quantity).toBeNull();
    expect(lines[0]?.unit).toBeNull();
    expect(lines[0]?.unitPriceMinor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ksefToEInvoice
// ---------------------------------------------------------------------------

describe('ksefToEInvoice', () => {
  it('converts to canonical EInvoice format', () => {
    const result = ksefToEInvoice(createParsedInvoice());
    expect(result.id).toBe('FV/2026/04/001');
    expect(result.issueDate).toBe('2026-04-11');
    expect(result.currencyCode).toBe('PLN');
    expect(result.profileId).toBe('ksef');
    expect(result.externalReference).toBe('KSeF-REF-001');
  });

  it('maps supplier and customer', () => {
    const result = ksefToEInvoice(createParsedInvoice());
    expect(result.supplier.id).toBe('1234567890');
    expect(result.supplier.name).toBe('Seller Sp. z o.o.');
    expect(result.supplier.address).toBe('ul. Testowa 1');
    expect(result.supplier.country).toBe('PL');
    expect(result.customer.id).toBe('0987654321');
    expect(result.customer.country).toBe('PL');
  });

  it('maps monetary totals', () => {
    const result = ksefToEInvoice(createParsedInvoice());
    expect(result.taxExclusiveAmount).toBe(100000);
    expect(result.taxInclusiveAmount).toBe(123000);
    expect(result.payableAmount).toBe(123000);
  });

  it('maps invoice type code from KSeF type', () => {
    expect(ksefToEInvoice(createParsedInvoice({ invoiceType: 'VAT' })).invoiceTypeCode).toBe(
      '380',
    );
    expect(ksefToEInvoice(createParsedInvoice({ invoiceType: 'KOR' })).invoiceTypeCode).toBe(
      '381',
    );
    expect(
      ksefToEInvoice(createParsedInvoice({ invoiceType: 'CORRECTIVE' })).invoiceTypeCode,
    ).toBe('381');
    expect(
      ksefToEInvoice(createParsedInvoice({ invoiceType: 'UNKNOWN' })).invoiceTypeCode,
    ).toBe('380');
  });

  it('builds tax breakdown from lines grouped by VAT rate', () => {
    const parsed = createParsedInvoice({
      lines: [
        { lineNumber: 1, description: 'A', vatRate: '23', netAmountMinor: 100, vatAmountMinor: 23 },
        { lineNumber: 2, description: 'B', vatRate: '23', netAmountMinor: 200, vatAmountMinor: 46 },
        { lineNumber: 3, description: 'C', vatRate: '8', netAmountMinor: 50, vatAmountMinor: 4 },
      ],
    });

    const result = ksefToEInvoice(parsed);
    expect(result.taxBreakdown).toHaveLength(2);

    const rate23 = result.taxBreakdown.find(t => t.percent === 23);
    expect(rate23?.taxableAmountMinor).toBe(300);
    expect(rate23?.taxAmountMinor).toBe(69);
    expect(rate23?.taxCategory).toBe('S');

    const rate8 = result.taxBreakdown.find(t => t.percent === 8);
    expect(rate8?.taxableAmountMinor).toBe(50);
    expect(rate8?.taxAmountMinor).toBe(4);
    expect(rate8?.taxCategory).toBe('S');
  });

  it('handles zero-rate lines as Z category', () => {
    const parsed = createParsedInvoice({
      lines: [
        { lineNumber: 1, description: 'A', vatRate: '0', netAmountMinor: 100, vatAmountMinor: 0 },
      ],
    });
    const result = ksefToEInvoice(parsed);
    expect(result.taxBreakdown[0]?.taxCategory).toBe('Z');
    expect(result.taxBreakdown[0]?.percent).toBe(0);
  });

  it('maps payment means with method code', () => {
    const result = ksefToEInvoice(
      createParsedInvoice({
        payment: { dueDate: '2026-05-11', bankAccount: 'PL1234', method: 'PRZELEW' },
      }),
    );
    expect(result.paymentMeans?.dueDate).toBe('2026-05-11');
    expect(result.paymentMeans?.bankAccount).toBe('PL1234');
    expect(result.paymentMeans?.code).toBe('30'); // Credit transfer
  });

  it('maps GOTOWKA payment method to code 10 (Cash)', () => {
    const result = ksefToEInvoice(
      createParsedInvoice({ payment: { method: 'GOTOWKA' } }),
    );
    expect(result.paymentMeans?.code).toBe('10');
  });

  it('maps KARTA payment method to code 48 (Bank card)', () => {
    const result = ksefToEInvoice(
      createParsedInvoice({ payment: { method: 'KARTA' } }),
    );
    expect(result.paymentMeans?.code).toBe('48');
  });

  it('returns undefined paymentMeans when no payment', () => {
    const result = ksefToEInvoice(createParsedInvoice({ payment: undefined }));
    expect(result.paymentMeans).toBeUndefined();
  });

  it('maps invoice lines preserving all fields', () => {
    const result = ksefToEInvoice(createParsedInvoice());
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.description).toBe('Development Services');
    expect(result.lines[0]?.quantity).toBe(10);
    expect(result.lines[0]?.netAmountMinor).toBe(100000);
  });
});
