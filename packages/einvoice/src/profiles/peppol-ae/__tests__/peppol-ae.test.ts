import { describe, expect, it } from 'vitest';
import type { EInvoice } from '../../../types/invoice.js';
import { PINT_AE_CUSTOMIZATION_ID, UAE_SCHEME_ID } from '../constants.js';
import { generatePintAeXml } from '../generator.js';
import { parsePintAeXml } from '../parser.js';
import { PeppolAEQRCode } from '../qr-code.js';
import { validatePintAeXml } from '../validator.js';

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

const makeInvoice = (overrides?: Partial<EInvoice>): EInvoice => ({
  id: 'INV-AE-001',
  issueDate: '2026-04-01',
  dueDate: '2026-04-15',
  invoiceTypeCode: '380',
  currencyCode: 'AED',
  supplier: { id: '100000000000003', name: 'Supplier Co', country: 'AE' },
  customer: { id: '100000000000007', name: 'Buyer Co', country: 'AE' },
  lines: [
    {
      lineNumber: 1,
      description: 'Consulting',
      quantity: 10,
      unit: 'HUR',
      unitPriceMinor: 5000,
      netAmountMinor: 50000,
      vatRate: 'S',
      vatAmountMinor: 2500,
    },
  ],
  taxExclusiveAmount: 50000,
  taxInclusiveAmount: 52500,
  payableAmount: 52500,
  taxBreakdown: [{ taxableAmountMinor: 50000, taxAmountMinor: 2500, taxCategory: 'S', percent: 5 }],
  profileId: 'peppol-ae',
  extensions: { buyerReference: 'PO-2026-001' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

describe('validatePintAeXml', () => {
  it('returns valid for well-formed PINT-AE XML', () => {
    const xml = generatePintAeXml(makeInvoice());
    const result = validatePintAeXml(xml);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.profileId).toBe('peppol-ae');
  });

  it('returns PARSE_ERROR when XML parsing throws', () => {
    // fast-xml-parser throws on null/undefined input — exercises the catch branch
    const result = validatePintAeXml(null as unknown as string);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PARSE_ERROR' })]),
    );
    expect(result.profileId).toBe('peppol-ae');
  });

  it('returns MISSING_ROOT when Invoice element is absent', () => {
    const xml = '<Document><cbc:ID>123</cbc:ID></Document>';
    const result = validatePintAeXml(xml);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_ROOT' })]),
    );
  });

  it('returns WRONG_CUSTOMIZATION_ID for incorrect customization', () => {
    const xml = generatePintAeXml(makeInvoice());
    const tampered = xml.replace(PINT_AE_CUSTOMIZATION_ID, 'urn:wrong:id');
    const result = validatePintAeXml(tampered);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WRONG_CUSTOMIZATION_ID' })]),
    );
  });

  it('returns MISSING_BUYER_REFERENCE when BuyerReference is removed', () => {
    const xml = generatePintAeXml(makeInvoice());
    const stripped = xml.replace(/<cbc:BuyerReference>.*?<\/cbc:BuyerReference>/, '');
    const result = validatePintAeXml(stripped);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_BUYER_REFERENCE' })]),
    );
  });

  it('returns MISSING_CURRENCY_CODE when DocumentCurrencyCode is removed', () => {
    const xml = generatePintAeXml(makeInvoice());
    const stripped = xml.replace(/<cbc:DocumentCurrencyCode>.*?<\/cbc:DocumentCurrencyCode>/, '');
    const result = validatePintAeXml(stripped);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_CURRENCY_CODE' })]),
    );
  });

  it('returns MISSING_SUPPLIER_TRN when supplier lacks schemeID 0192', () => {
    const xml = generatePintAeXml(makeInvoice());
    // Remove the supplier schemeID attribute so the TRN check fails
    const stripped = xml.replace(
      new RegExp(`(<cac:AccountingSupplierParty>[\\s\\S]*?)schemeID="${UAE_SCHEME_ID}"`),
      '$1schemeID="9999"',
    );
    const result = validatePintAeXml(stripped);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_SUPPLIER_TRN' })]),
    );
  });

  it('returns MISSING_TAX_SUBTOTAL when TaxSubtotal is removed', () => {
    const xml = generatePintAeXml(makeInvoice());
    const stripped = xml.replace(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>/, '');
    const result = validatePintAeXml(stripped);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_TAX_SUBTOTAL' })]),
    );
  });

  it('returns MISSING_LINE_AMOUNT when LineExtensionAmount is removed', () => {
    const xml = generatePintAeXml(makeInvoice());
    const stripped = xml.replace(
      /<cbc:LineExtensionAmount[^>]*>.*?<\/cbc:LineExtensionAmount>/,
      '',
    );
    const result = validatePintAeXml(stripped);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_LINE_AMOUNT' })]),
    );
  });

  it('returns MISSING_CUSTOMER_TRN as warning when customer lacks schemeID 0192', () => {
    const xml = generatePintAeXml(makeInvoice());
    // Change the customer schemeID so TRN check triggers a warning
    const tampered = xml.replace(
      new RegExp(`(<cac:AccountingCustomerParty>[\\s\\S]*?)schemeID="${UAE_SCHEME_ID}"`),
      '$1schemeID="9999"',
    );
    const result = validatePintAeXml(tampered);

    // Customer TRN is a warning, not an error — invoice can still be valid
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_CUSTOMER_TRN' })]),
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

describe('generatePintAeXml', () => {
  it('produces XML with PINT_AE_CUSTOMIZATION_ID and Invoice root', () => {
    const xml = generatePintAeXml(makeInvoice());

    expect(xml).toContain('<Invoice');
    expect(xml).toContain(PINT_AE_CUSTOMIZATION_ID);
  });

  it('uses AED currency throughout', () => {
    const xml = generatePintAeXml(makeInvoice());

    expect(xml).toContain('currencyID="AED"');
    expect(xml).toContain('<cbc:DocumentCurrencyCode>AED</cbc:DocumentCurrencyCode>');
  });

  it('generates correct line count for multi-line invoice', () => {
    const invoice = makeInvoice({
      lines: [
        {
          lineNumber: 1,
          description: 'Line A',
          quantity: 1,
          unit: 'EA',
          unitPriceMinor: 1000,
          netAmountMinor: 1000,
          vatRate: 'S',
        },
        {
          lineNumber: 2,
          description: 'Line B',
          quantity: 2,
          unit: 'EA',
          unitPriceMinor: 2000,
          netAmountMinor: 4000,
          vatRate: 'S',
        },
        {
          lineNumber: 3,
          description: 'Line C',
          quantity: 5,
          unit: 'HUR',
          unitPriceMinor: 500,
          netAmountMinor: 2500,
          vatRate: 'Z',
        },
      ],
    });

    const xml = generatePintAeXml(invoice);
    const lineMatches = xml.match(/<cac:InvoiceLine>/g);

    expect(lineMatches).toHaveLength(3);
  });

  it('uses buyerReference from extensions', () => {
    const xml = generatePintAeXml(makeInvoice());

    expect(xml).toContain('<cbc:BuyerReference>PO-2026-001</cbc:BuyerReference>');
  });
});

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe('parsePintAeXml', () => {
  it('throws when Invoice root element is missing', () => {
    const xml = '<Document><cbc:ID>123</cbc:ID></Document>';

    expect(() => parsePintAeXml(xml)).toThrow('Invalid PINT-AE XML: missing Invoice root element');
  });

  it('parses valid XML into correct EInvoice fields', () => {
    const xml = generatePintAeXml(makeInvoice());
    const result = parsePintAeXml(xml);

    expect(result.id).toBe('INV-AE-001');
    expect(result.issueDate).toBe('2026-04-01');
    expect(result.currencyCode).toBe('AED');
    expect(result.profileId).toBe('peppol-ae');
    expect(result.supplier.name).toBe('Supplier Co');
    expect(result.customer.name).toBe('Buyer Co');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.description).toBe('Consulting');
    expect(result.taxBreakdown).toHaveLength(1);
    expect(result.extensions).toEqual(
      expect.objectContaining({
        customizationId: PINT_AE_CUSTOMIZATION_ID,
        buyerReference: 'PO-2026-001',
      }),
    );
  });

  it('merges metadata into the result', () => {
    const xml = generatePintAeXml(makeInvoice());
    const result = parsePintAeXml(xml, { transmissionId: 'TX-9999' });

    expect(result.externalReference).toBe('TX-9999');
  });
});

// ---------------------------------------------------------------------------
// QR Code
// ---------------------------------------------------------------------------

describe('PeppolAEQRCode', () => {
  const qr = new PeppolAEQRCode();

  it('generateQR returns a PNG buffer with correct magic bytes', async () => {
    const invoice = makeInvoice();
    const buffer = await qr.generateQR(invoice);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });

  it('parseQR extracts fields from pipe-delimited data', async () => {
    const data = Buffer.from('Supplier Co|100000000000003|2026-04-01|525.00|25.00');
    const result = await qr.parseQR(data);

    expect(result.supplier?.name).toBe('Supplier Co');
    expect(result.supplier?.id).toBe('100000000000003');
    expect(result.issueDate).toBe('2026-04-01');
    expect(result.taxInclusiveAmount).toBe(52500);
    expect(result.taxBreakdown?.[0]?.taxAmountMinor).toBe(2500);
  });

  it('parseQR returns empty object when data has fewer than 5 parts', async () => {
    const data = Buffer.from('only|three|parts');
    const result = await qr.parseQR(data);

    expect(result).toEqual({});
  });
});
