import { describe, expect, it } from 'vitest';
import type { EInvoice } from '../../../types/invoice.js';
import { generateFa3Xml } from '../generator.js';

// ---------------------------------------------------------------------------
// Test Fixture
// ---------------------------------------------------------------------------

function createTestInvoice(overrides?: Partial<EInvoice>): EInvoice {
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
        grossAmountMinor: 123000,
      },
    ],
    taxExclusiveAmount: 100000,
    taxInclusiveAmount: 123000,
    payableAmount: 123000,
    taxBreakdown: [
      { taxableAmountMinor: 100000, taxAmountMinor: 23000, taxCategory: 'S', percent: 23 },
    ],
    profileId: 'ksef',
    ...overrides,
  };
}

describe('generateFa3Xml', () => {
  it('produces XML containing invoice number', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).toContain('FV/2026/04/001');
  });

  it('includes seller NIP and name', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).toContain('<NIP>1234567890</NIP>');
    expect(xml).toContain('<Nazwa>Seller Sp. z o.o.</Nazwa>');
  });

  it('includes buyer NIP and name', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).toContain('<NIP>9876543210</NIP>');
    expect(xml).toContain('<Nazwa>Buyer S.A.</Nazwa>');
  });

  it('includes supplier address when present', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).toContain('<Ulica>ul. Testowa 1</Ulica>');
  });

  it('omits Adres element when no address', () => {
    const xml = generateFa3Xml(createTestInvoice({ supplier: { id: '1234567890', name: 'S' } }));
    expect(xml).not.toContain('<Adres>');
  });

  it('converts amounts from minor units correctly', () => {
    const xml = generateFa3Xml(createTestInvoice());
    // 100000 minor = 1000.00 PLN
    expect(xml).toContain('<P_13_1>1000.00</P_13_1>');
    // VAT = 23000 minor = 230.00 PLN
    expect(xml).toContain('<P_14_1>230.00</P_14_1>');
    // Gross = 123000 minor = 1230.00 PLN
    expect(xml).toContain('<P_15>1230.00</P_15>');
  });

  it('maps invoice type code 381 to KOR', () => {
    const xml = generateFa3Xml(createTestInvoice({ invoiceTypeCode: '381' }));
    expect(xml).toContain('<RodzajFaktury>KOR</RodzajFaktury>');
  });

  it('maps default invoice type code to VAT', () => {
    const xml = generateFa3Xml(createTestInvoice({ invoiceTypeCode: '380' }));
    expect(xml).toContain('<RodzajFaktury>VAT</RodzajFaktury>');
  });

  it('includes issue date', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).toContain('<P_1>2026-04-11</P_1>');
  });

  it('includes currency code', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).toContain('<KodWaluty>PLN</KodWaluty>');
  });

  it('includes line item fields', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).toContain('<NrWierszaFa>1</NrWierszaFa>');
    expect(xml).toContain('<P_7>Development Services</P_7>');
    expect(xml).toContain('<P_8B>10</P_8B>');
    expect(xml).toContain('<P_8A>szt</P_8A>');
    expect(xml).toContain('<P_9A>100.00</P_9A>');
    expect(xml).toContain('<P_11>1000.00</P_11>');
    expect(xml).toContain('<P_12>23</P_12>');
  });

  it('includes payment information when provided', () => {
    const xml = generateFa3Xml(
      createTestInvoice({
        paymentMeans: {
          dueDate: '2026-05-11',
          bankAccount: 'PL12345678901234567890123456',
        },
      }),
    );
    expect(xml).toContain('<TerminPlatnosci>2026-05-11</TerminPlatnosci>');
    expect(xml).toContain('<NrRB>PL12345678901234567890123456</NrRB>');
  });

  it('omits payment section when no payment means', () => {
    const xml = generateFa3Xml(createTestInvoice());
    expect(xml).not.toContain('<Platnosc>');
  });

  it('handles lines with optional fields omitted', () => {
    const invoice = createTestInvoice({
      lines: [
        {
          lineNumber: 1,
          description: 'Service',
        },
      ],
    });
    const xml = generateFa3Xml(invoice);
    expect(xml).toContain('<P_7>Service</P_7>');
    expect(xml).not.toContain('<P_8B>');
    expect(xml).not.toContain('<P_8A>');
  });

  it('handles multiple line items', () => {
    const invoice = createTestInvoice({
      lines: [
        { lineNumber: 1, description: 'Line 1', netAmountMinor: 50000, vatRate: '23' },
        { lineNumber: 2, description: 'Line 2', netAmountMinor: 50000, vatRate: '8' },
      ],
    });
    const xml = generateFa3Xml(invoice);
    expect(xml).toContain('<NrWierszaFa>1</NrWierszaFa>');
    expect(xml).toContain('<NrWierszaFa>2</NrWierszaFa>');
    expect(xml).toContain('<P_7>Line 1</P_7>');
    expect(xml).toContain('<P_7>Line 2</P_7>');
  });
});
