import { describe, expect, it } from 'vitest';
import type { EInvoice } from '../../../types/invoice.js';
import { generateZatcaXml } from '../generator.js';
import { parseZatcaXml } from '../parser.js';

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function makeInvoice(overrides?: Partial<EInvoice>): EInvoice {
  return {
    id: 'INV-001',
    issueDate: '2025-03-15',
    invoiceTypeCode: '388',
    currencyCode: 'SAR',
    supplier: {
      id: '300000000000003',
      name: 'Acme Saudi LLC',
      address: '123 King Fahd Road',
      country: 'SA',
    },
    customer: {
      id: '300000000000004',
      name: 'Beta Corp',
      address: '456 Olaya Street',
      country: 'SA',
    },
    lines: [
      {
        lineNumber: 1,
        description: 'Consulting Services',
        quantity: 2,
        unit: 'HUR',
        unitPriceMinor: 10000,
        netAmountMinor: 20000,
        vatRate: 'S',
        vatAmountMinor: 3000,
        grossAmountMinor: 23000,
      },
    ],
    taxExclusiveAmount: 20000,
    taxInclusiveAmount: 23000,
    payableAmount: 23000,
    taxBreakdown: [
      {
        taxableAmountMinor: 20000,
        taxAmountMinor: 3000,
        taxCategory: 'S',
        percent: 15,
      },
    ],
    profileId: 'zatca',
    extensions: {
      invoiceType: 'standard',
      invoiceSubtype: '0100000',
      icv: 42,
      pih: 'aabbccdd',
      uuid: '550e8400-e29b-41d4-a716-446655440000',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Generator tests
// ---------------------------------------------------------------------------

describe('generateZatcaXml', () => {
  it('standard invoice contains clearance:1.0 ProfileID', () => {
    const invoice = makeInvoice({
      extensions: {
        invoiceType: 'standard',
        invoiceSubtype: '0100000',
        icv: 1,
        pih: 'aabb',
        uuid: 'test-uuid',
      },
    });

    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('clearance:1.0');
  });

  it('simplified invoice contains reporting:1.0 ProfileID', () => {
    const invoice = makeInvoice({
      extensions: {
        invoiceType: 'simplified',
        invoiceSubtype: '0200000',
        icv: 1,
        pih: 'aabb',
        uuid: 'test-uuid',
      },
    });

    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('reporting:1.0');
  });

  it('zero-VAT invoice has TaxAmount = 0.00', () => {
    const invoice = makeInvoice({
      taxBreakdown: [
        {
          taxableAmountMinor: 10000,
          taxAmountMinor: 0,
          taxCategory: 'Z',
          percent: 0,
        },
      ],
    });

    const xml = generateZatcaXml(invoice);
    // The total TaxAmount element should contain 0.00
    expect(xml).toMatch(/<cbc:TaxAmount[^>]*>0\.00<\/cbc:TaxAmount>/);
  });

  it('multi-line invoice has correct LineExtensionAmount per line', () => {
    const invoice = makeInvoice({
      lines: [
        {
          lineNumber: 1,
          description: 'Item A',
          quantity: 1,
          unit: 'EA',
          unitPriceMinor: 5000,
          netAmountMinor: 5000,
          vatRate: 'S',
          vatAmountMinor: 750,
          grossAmountMinor: 5750,
        },
        {
          lineNumber: 2,
          description: 'Item B',
          quantity: 3,
          unit: 'EA',
          unitPriceMinor: 2000,
          netAmountMinor: 6000,
          vatRate: 'S',
          vatAmountMinor: 900,
          grossAmountMinor: 6900,
        },
      ],
    });

    const xml = generateZatcaXml(invoice);
    // Line 1: 5000 minor = 50.00
    expect(xml).toContain('>50.00</cbc:LineExtensionAmount>');
    // Line 2: 6000 minor = 60.00
    expect(xml).toContain('>60.00</cbc:LineExtensionAmount>');
  });

  it('date with T separator splits into correct IssueDate and IssueTime', () => {
    const invoice = makeInvoice({ issueDate: '2025-03-15T14:30:00' });

    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('<cbc:IssueDate>2025-03-15</cbc:IssueDate>');
    expect(xml).toContain('<cbc:IssueTime>14:30:00</cbc:IssueTime>');
  });

  it('date without T separator sets IssueTime to 00:00:00', () => {
    const invoice = makeInvoice({ issueDate: '2025-03-15' });

    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('<cbc:IssueDate>2025-03-15</cbc:IssueDate>');
    expect(xml).toContain('<cbc:IssueTime>00:00:00</cbc:IssueTime>');
  });

  it('includes cac:PaymentMeans when paymentMeans provided', () => {
    const invoice = makeInvoice({
      paymentMeans: {
        code: '42',
        dueDate: '2025-04-15',
        bankAccount: 'SA1234567890',
        bankName: 'Al Rajhi Bank',
      },
    });

    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('<cac:PaymentMeans>');
    expect(xml).toContain('<cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>');
    expect(xml).toContain('<cbc:PaymentDueDate>2025-04-15</cbc:PaymentDueDate>');
    expect(xml).toContain('SA1234567890');
    expect(xml).toContain('Al Rajhi Bank');
  });

  it('omits cac:PaymentMeans when not provided', () => {
    const invoice = makeInvoice({ paymentMeans: undefined });

    const xml = generateZatcaXml(invoice);
    expect(xml).not.toContain('<cac:PaymentMeans>');
  });

  it('output contains Invoice root element', () => {
    const xml = generateZatcaXml(makeInvoice());
    expect(xml).toContain('<Invoice');
  });

  it('PIH hex is correctly converted to base64 in output', () => {
    const pihHex = 'deadbeef';
    const expectedBase64 = Buffer.from(pihHex, 'hex').toString('base64');
    const invoice = makeInvoice({
      extensions: {
        invoiceType: 'standard',
        invoiceSubtype: '0100000',
        icv: 1,
        pih: pihHex,
        uuid: 'test-uuid',
      },
    });

    const xml = generateZatcaXml(invoice);
    expect(xml).toContain(expectedBase64);
    // The raw hex should NOT appear in the XML output
    expect(xml).not.toContain(`>${pihHex}<`);
  });
});

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

describe('parseZatcaXml', () => {
  it('throws on XML with no Invoice root element', () => {
    const badXml = '<Document><cbc:ID>X</cbc:ID></Document>';
    expect(() => parseZatcaXml(badXml)).toThrow('Invalid ZATCA XML');
  });

  it('extracts all fields correctly from valid XML', () => {
    const invoice = makeInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml);

    expect(parsed.id).toBe('INV-001');
    expect(parsed.invoiceTypeCode).toBe('388');
    expect(parsed.currencyCode).toBe('SAR');
    expect(parsed.profileId).toBe('zatca');
    expect(parsed.supplier.id).toBe('300000000000003');
    expect(parsed.supplier.name).toBe('Acme Saudi LLC');
    expect(parsed.supplier.address).toBe('123 King Fahd Road');
    expect(parsed.supplier.country).toBe('SA');
    expect(parsed.customer.id).toBe('300000000000004');
    expect(parsed.customer.name).toBe('Beta Corp');
    expect(parsed.taxExclusiveAmount).toBe(20000);
    expect(parsed.taxInclusiveAmount).toBe(23000);
    expect(parsed.payableAmount).toBe(23000);
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].description).toBe('Consulting Services');
    expect(parsed.lines[0].netAmountMinor).toBe(20000);
    expect(parsed.taxBreakdown).toHaveLength(1);
    expect(parsed.taxBreakdown[0].taxCategory).toBe('S');
    expect(parsed.taxBreakdown[0].percent).toBe(15);

    // Extensions
    const ext = parsed.extensions as Record<string, unknown>;
    expect(ext.invoiceType).toBe('standard');
    expect(ext.icv).toBe(42);
    expect(ext.pih).toBe('aabbccdd');
    expect(ext.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('merges metadata into extensions', () => {
    const invoice = makeInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml, { source: 'api', batchId: 99 });

    const ext = parsed.extensions as Record<string, unknown>;
    expect(ext.source).toBe('api');
    expect(ext.batchId).toBe(99);
    // Original extension fields still present
    expect(ext.icv).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('round-trip (generate then parse)', () => {
  it('key fields survive generate -> parse cycle', () => {
    const original = makeInvoice();
    const xml = generateZatcaXml(original);
    const parsed = parseZatcaXml(xml);

    expect(parsed.id).toBe(original.id);
    expect(parsed.invoiceTypeCode).toBe(original.invoiceTypeCode);
    expect(parsed.currencyCode).toBe(original.currencyCode);
    expect(parsed.taxExclusiveAmount).toBe(original.taxExclusiveAmount);
    expect(parsed.taxInclusiveAmount).toBe(original.taxInclusiveAmount);
    expect(parsed.payableAmount).toBe(original.payableAmount);
    expect(parsed.supplier.id).toBe(original.supplier.id);
    expect(parsed.supplier.name).toBe(original.supplier.name);
    expect(parsed.customer.id).toBe(original.customer.id);
    expect(parsed.customer.name).toBe(original.customer.name);

    const ext = parsed.extensions as Record<string, unknown>;
    expect(ext.invoiceType).toBe('standard');
    expect(ext.icv).toBe(42);
    expect(ext.pih).toBe('aabbccdd');
    expect(ext.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('multi-line invoice preserves line count and amounts', () => {
    const original = makeInvoice({
      lines: [
        {
          lineNumber: 1,
          description: 'Widget A',
          quantity: 5,
          unit: 'EA',
          unitPriceMinor: 1000,
          netAmountMinor: 5000,
          vatRate: 'S',
          vatAmountMinor: 750,
          grossAmountMinor: 5750,
        },
        {
          lineNumber: 2,
          description: 'Widget B',
          quantity: 10,
          unit: 'KGM',
          unitPriceMinor: 300,
          netAmountMinor: 3000,
          vatRate: 'S',
          vatAmountMinor: 450,
          grossAmountMinor: 3450,
        },
        {
          lineNumber: 3,
          description: 'Service C',
          quantity: 1,
          unit: 'HUR',
          unitPriceMinor: 20000,
          netAmountMinor: 20000,
          vatRate: 'Z',
          vatAmountMinor: 0,
          grossAmountMinor: 20000,
        },
      ],
      taxExclusiveAmount: 28000,
      taxInclusiveAmount: 29200,
      payableAmount: 29200,
      taxBreakdown: [
        { taxableAmountMinor: 8000, taxAmountMinor: 1200, taxCategory: 'S', percent: 15 },
        { taxableAmountMinor: 20000, taxAmountMinor: 0, taxCategory: 'Z', percent: 0 },
      ],
    });

    const xml = generateZatcaXml(original);
    const parsed = parseZatcaXml(xml);

    expect(parsed.lines).toHaveLength(3);

    // Verify each line's net amount
    expect(parsed.lines[0].netAmountMinor).toBe(5000);
    expect(parsed.lines[0].description).toBe('Widget A');
    expect(parsed.lines[0].quantity).toBe(5);
    expect(parsed.lines[0].unit).toBe('EA');

    expect(parsed.lines[1].netAmountMinor).toBe(3000);
    expect(parsed.lines[1].description).toBe('Widget B');
    expect(parsed.lines[1].quantity).toBe(10);
    expect(parsed.lines[1].unit).toBe('KGM');

    expect(parsed.lines[2].netAmountMinor).toBe(20000);
    expect(parsed.lines[2].description).toBe('Service C');

    // Monetary totals
    expect(parsed.taxExclusiveAmount).toBe(28000);
    expect(parsed.taxInclusiveAmount).toBe(29200);
    expect(parsed.payableAmount).toBe(29200);

    // Tax breakdown
    expect(parsed.taxBreakdown).toHaveLength(2);
    expect(parsed.taxBreakdown[0].taxAmountMinor).toBe(1200);
    expect(parsed.taxBreakdown[1].taxAmountMinor).toBe(0);
  });
});
