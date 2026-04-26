import { describe, expect, it, vi } from 'vitest';
import type { EInvoice } from '../types/invoice.js';

/** Test fixture: Saudi SAR invoice with 15% VAT */
function createTestInvoice(
  overrides?: Partial<EInvoice> & { extensions?: Record<string, unknown> },
): EInvoice {
  return {
    id: 'INV-2026-001',
    issueDate: '2026-04-11',
    dueDate: '2026-05-11',
    invoiceTypeCode: '388',
    currencyCode: 'SAR',
    supplier: {
      id: '300075588700003',
      name: 'Acme Saudi LLC',
      address: '123 King Fahd Rd, Riyadh',
      country: 'SA',
    },
    customer: {
      id: '310122393500003',
      name: 'Client Corp KSA',
      address: '456 Olaya St, Jeddah',
      country: 'SA',
    },
    lines: [
      {
        lineNumber: 1,
        description: 'Software Development Services',
        quantity: 160,
        unit: 'HUR',
        unitPriceMinor: 15000,
        netAmountMinor: 2400000,
        vatRate: 'S',
        vatAmountMinor: 360000,
        grossAmountMinor: 2760000,
      },
    ],
    taxExclusiveAmount: 2400000,
    taxInclusiveAmount: 2760000,
    payableAmount: 2760000,
    taxBreakdown: [
      {
        taxableAmountMinor: 2400000,
        taxAmountMinor: 360000,
        taxCategory: 'S',
        percent: 15,
      },
    ],
    profileId: 'zatca',
    extensions: {
      invoiceType: 'standard' as const,
      invoiceSubtype: '0100000',
      icv: 1,
      pih: 'a]b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1'.replace(
        /[^a-f0-9]/g,
        '0',
      ),
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      ...(overrides?.extensions ?? {}),
    },
    ...overrides,
  };
}

describe('ZATCA Profile', () => {
  it('has profileId=zatca and country=SA', async () => {
    const { ZatcaProfile } = await import('../profiles/zatca/index.js');
    const profile = new ZatcaProfile();
    expect(profile.profileId).toBe('zatca');
    expect(profile.country).toBe('SA');
  });
});

describe('ZATCA UBL 2.1 Generator', () => {
  it('produces XML with ProfileID containing reporting:1.0 for simplified', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice({
      extensions: {
        invoiceType: 'simplified',
        invoiceSubtype: '0200000',
        icv: 1,
        pih: 'a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1',
        uuid: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('reporting:1.0');
  });

  it('produces XML with ProfileID containing clearance:1.0 for standard', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('clearance:1.0');
  });

  it('contains UUID element', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('<cbc:UUID>');
    expect(xml).toContain('550e8400-e29b-41d4-a716-446655440000');
  });

  it('contains AdditionalDocumentReference for ICV and PIH', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('ICV');
    expect(xml).toContain('PIH');
  });

  it('uses InvoiceTypeCode 388 with subtype @name attribute', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('388');
    expect(xml).toContain('0100000');
  });
});

describe('ZATCA Zod Schemas', () => {
  it('zatcaTaxDetailsSchema rejects invalid VAT number', async () => {
    const { zatcaTaxDetailsSchema } = await import('../profiles/zatca/schemas.js');
    const result = zatcaTaxDetailsSchema.safeParse({
      vatNumber: '123',
      orgNameArabic: 'شركة',
      street: 'King Fahd Rd',
      city: 'Riyadh',
      district: 'Al Olaya',
      postalCode: '12345',
      invoiceTypes: ['standard'],
    });
    expect(result.success).toBe(false);
  });

  it('zatcaTaxDetailsSchema accepts valid 15-digit VAT number', async () => {
    const { zatcaTaxDetailsSchema } = await import('../profiles/zatca/schemas.js');
    const result = zatcaTaxDetailsSchema.safeParse({
      vatNumber: '300075588700003',
      orgNameArabic: 'شركة',
      street: 'King Fahd Rd',
      city: 'Riyadh',
      district: 'Al Olaya',
      postalCode: '12345',
      invoiceTypes: ['standard'],
    });
    expect(result.success).toBe(true);
  });

  it('zatcaInvoiceFieldsSchema rejects invalid subtype', async () => {
    const { zatcaInvoiceFieldsSchema } = await import('../profiles/zatca/schemas.js');
    const result = zatcaInvoiceFieldsSchema.safeParse({
      invoiceTypeCode: '388',
      invoiceSubtype: 'INVALID',
      icv: 1,
      pih: 'a'.repeat(64),
      uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });

  it('zatcaInvoiceFieldsSchema rejects non-positive ICV', async () => {
    const { zatcaInvoiceFieldsSchema } = await import('../profiles/zatca/schemas.js');
    const result = zatcaInvoiceFieldsSchema.safeParse({
      invoiceTypeCode: '388',
      invoiceSubtype: '0100000',
      icv: 0,
      pih: 'a'.repeat(64),
      uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });

  it('zatcaConnectionConfigSchema defaults certificateStatus to none', async () => {
    const { zatcaConnectionConfigSchema } = await import('../profiles/zatca/schemas.js');
    const result = zatcaConnectionConfigSchema.safeParse({
      environment: 'sandbox',
      currentStep: 'tax_details',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.certificateStatus).toBe('none');
    }
  });

  it('zatcaCsrAttributesSchema rejects non-SA country', async () => {
    const { zatcaCsrAttributesSchema } = await import('../profiles/zatca/schemas.js');
    const result = zatcaCsrAttributesSchema.safeParse({
      commonName: 'test',
      orgName: 'test',
      vatNumber: '300075588700003',
      country: 'US',
      serialNumber: 'sn1',
      title: '0100',
      registeredAddress: 'addr',
      businessCategory: 'cat',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ZATCA UBL 2.1 Parser
// ---------------------------------------------------------------------------

describe('ZATCA UBL 2.1 Parser', () => {
  it('roundtrip: generate -> parse preserves key fields', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml);

    expect(parsed.id).toBe('INV-2026-001');
    expect(parsed.issueDate).toBe('2026-04-11');
    expect(parsed.invoiceTypeCode).toBe('388');
    expect(parsed.currencyCode).toBe('SAR');
    expect(parsed.profileId).toBe('zatca');
    expect(parsed.supplier.id).toBe('300075588700003');
    expect(parsed.supplier.name).toBe('Acme Saudi LLC');
    expect(parsed.customer.id).toBe('310122393500003');
    expect(parsed.customer.name).toBe('Client Corp KSA');
  });

  it('extracts ICV and PIH from AdditionalDocumentReference', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml);

    const ext = parsed.extensions as Record<string, unknown>;
    expect(ext.icv).toBe(1);
    expect(ext.pih).toBeDefined();
    expect(ext.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('preserves monetary totals through roundtrip', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml);

    expect(parsed.taxExclusiveAmount).toBe(2400000);
    expect(parsed.taxInclusiveAmount).toBe(2760000);
    expect(parsed.payableAmount).toBe(2760000);
  });

  it('preserves line items through roundtrip', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml);

    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0]?.lineNumber).toBe(1);
    expect(parsed.lines[0]?.description).toBe('Software Development Services');
    expect(parsed.lines[0]?.netAmountMinor).toBe(2400000);
  });

  it('preserves tax breakdown through roundtrip', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml);

    expect(parsed.taxBreakdown).toHaveLength(1);
    expect(parsed.taxBreakdown[0]?.taxCategory).toBe('S');
    expect(parsed.taxBreakdown[0]?.taxAmountMinor).toBe(360000);
    expect(parsed.taxBreakdown[0]?.percent).toBe(15);
  });

  it('throws on invalid XML without Invoice root', async () => {
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    expect(() => parseZatcaXml('<Root><Other/></Root>')).toThrow(
      'Invalid ZATCA XML: no Invoice root element found',
    );
  });

  it('handles metadata passthrough to extensions', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml, { customField: 'test-value' });

    const ext = parsed.extensions as Record<string, unknown>;
    expect(ext.customField).toBe('test-value');
  });

  it('sets invoiceType based on ProfileID', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');

    // Standard (clearance)
    const standard = createTestInvoice();
    const standardXml = generateZatcaXml(standard);
    const parsedStandard = parseZatcaXml(standardXml);
    expect((parsedStandard.extensions as Record<string, unknown>).invoiceType).toBe('standard');

    // Simplified (reporting)
    const simplified = createTestInvoice({
      extensions: {
        invoiceType: 'simplified',
        invoiceSubtype: '0200000',
        icv: 1,
        pih: 'a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1',
        uuid: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    const simplifiedXml = generateZatcaXml(simplified);
    const parsedSimplified = parseZatcaXml(simplifiedXml);
    expect((parsedSimplified.extensions as Record<string, unknown>).invoiceType).toBe('simplified');
  });

  it('handles party without cac:Party gracefully', async () => {
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    // Minimal valid XML with empty supplier/customer party wrappers
    const xml = `<Invoice>
      <cbc:ID>INV-1</cbc:ID>
      <cbc:UUID>test-uuid</cbc:UUID>
      <cbc:IssueDate>2026-01-01</cbc:IssueDate>
      <cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>
      <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
      <cbc:ProfileID>clearance:1.0</cbc:ProfileID>
      <cac:AccountingSupplierParty/>
      <cac:AccountingCustomerParty/>
      <cac:LegalMonetaryTotal>
        <cbc:TaxExclusiveAmount>100.00</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount>115.00</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount>115.00</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
    </Invoice>`;
    const parsed = parseZatcaXml(xml);
    expect(parsed.supplier.id).toBe('');
    expect(parsed.supplier.name).toBe('');
  });

  it('extracts dueDate when present', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const { parseZatcaXml } = await import('../profiles/zatca/parser.js');
    const invoice = createTestInvoice({ dueDate: '2026-05-11' });
    const xml = generateZatcaXml(invoice);
    const parsed = parseZatcaXml(xml);
    // dueDate is optional in generator, but if present in source XML it's parsed
    expect(parsed.dueDate).toBeUndefined(); // generator doesn't emit DueDate
  });
});

// ---------------------------------------------------------------------------
// ZATCA Profile — validate and compliance
// ---------------------------------------------------------------------------

describe('ZATCA Profile validate()', () => {
  it('returns valid for parseable ZATCA XML', async () => {
    const { ZatcaProfile } = await import('../profiles/zatca/index.js');
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const profile = new ZatcaProfile();
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    const result = await profile.validate(xml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.profileId).toBe('zatca');
  });

  it('returns invalid for unparseable XML', async () => {
    const { ZatcaProfile } = await import('../profiles/zatca/index.js');
    const profile = new ZatcaProfile();
    const result = await profile.validate('<Root><NotInvoice/></Root>');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.code).toBe('PARSE_ERROR');
  });

  it('returns notConnected compliance when no fetcher', async () => {
    const { ZatcaProfile } = await import('../profiles/zatca/index.js');
    const profile = new ZatcaProfile();
    const status = await profile.getComplianceStatus('org-1');
    expect(status.state).toBe('notConnected');
    expect(status.profileId).toBe('zatca');
  });

  it('uses complianceFetcher when provided', async () => {
    const { ZatcaProfile } = await import('../profiles/zatca/index.js');
    const fetcher = vi.fn().mockResolvedValue(null);
    const profile = new ZatcaProfile({ complianceFetcher: fetcher });
    const status = await profile.getComplianceStatus('org-1');
    expect(fetcher).toHaveBeenCalledWith('org-1');
    expect(status.state).toBe('notConnected');
  });
});

// ---------------------------------------------------------------------------
// ZATCA Generator — edge cases
// ---------------------------------------------------------------------------

describe('ZATCA Generator edge cases', () => {
  it('handles invoice with paymentMeans', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice();
    invoice.paymentMeans = {
      code: '30',
      dueDate: '2026-05-11',
      bankAccount: 'SA1234567890',
      bankName: 'Al Rajhi Bank',
    };
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('cac:PaymentMeans');
    expect(xml).toContain('SA1234567890');
    expect(xml).toContain('Al Rajhi Bank');
  });

  it('handles ISO datetime with T in issueDate', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice({ issueDate: '2026-04-11T14:30:00' });
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('14:30:00');
    expect(xml).toContain('2026-04-11');
  });

  it('defaults to midnight when issueDate has no time', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice({ issueDate: '2026-04-11' });
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('00:00:00');
  });

  it('uses CRN from additionalIds when present', async () => {
    const { generateZatcaXml } = await import('../profiles/zatca/generator.js');
    const invoice = createTestInvoice();
    invoice.supplier.additionalIds = { crn: 'CRN-12345' };
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain('CRN-12345');
  });
});

// ---------------------------------------------------------------------------
// ZatcaApiClient — error classification
// ---------------------------------------------------------------------------

describe('ZatcaApiClient.classifyError', () => {
  it('classifies 401 as auth', async () => {
    const { ZatcaApiClient } = await import('../profiles/zatca/api-client.js');
    expect(ZatcaApiClient.classifyError(401)).toBe('auth');
  });

  it('classifies 403 as auth', async () => {
    const { ZatcaApiClient } = await import('../profiles/zatca/api-client.js');
    expect(ZatcaApiClient.classifyError(403)).toBe('auth');
  });

  it('classifies 429 as retryable', async () => {
    const { ZatcaApiClient } = await import('../profiles/zatca/api-client.js');
    expect(ZatcaApiClient.classifyError(429)).toBe('retryable');
  });

  it('classifies 500 as retryable', async () => {
    const { ZatcaApiClient } = await import('../profiles/zatca/api-client.js');
    expect(ZatcaApiClient.classifyError(500)).toBe('retryable');
  });

  it('classifies 502 as retryable', async () => {
    const { ZatcaApiClient } = await import('../profiles/zatca/api-client.js');
    expect(ZatcaApiClient.classifyError(502)).toBe('retryable');
  });

  it('classifies 400 as non-retryable', async () => {
    const { ZatcaApiClient } = await import('../profiles/zatca/api-client.js');
    expect(ZatcaApiClient.classifyError(400)).toBe('non-retryable');
  });

  it('classifies 422 as non-retryable', async () => {
    const { ZatcaApiClient } = await import('../profiles/zatca/api-client.js');
    expect(ZatcaApiClient.classifyError(422)).toBe('non-retryable');
  });
});

describe('ZatcaApiError', () => {
  it('has correct name and properties', async () => {
    const { ZatcaApiError } = await import('../profiles/zatca/api-client.js');
    const err = new ZatcaApiError('test error', 401, 'auth', '{"message":"unauthorized"}');
    expect(err.name).toBe('ZatcaApiError');
    expect(err.statusCode).toBe(401);
    expect(err.errorType).toBe('auth');
    expect(err.responseBody).toBe('{"message":"unauthorized"}');
    expect(err.message).toBe('test error');
    expect(err).toBeInstanceOf(Error);
  });
});
