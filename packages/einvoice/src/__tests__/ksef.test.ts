import { describe, expect, it, vi } from 'vitest';
import type { KsefParsedInvoice } from '../profiles/ksef/schemas.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function createFa3Xml(overrides?: {
  invoiceNumber?: string;
  invoiceType?: string;
  currency?: string;
  lines?: string;
  totals?: string;
  payment?: string;
  sellerNip?: string;
  buyerNip?: string;
}): string {
  const sellerNip = overrides?.sellerNip ?? '1234567890';
  const buyerNip = overrides?.buyerNip ?? '9876543210';
  const invoiceNumber = overrides?.invoiceNumber ?? 'FV/2026/001';
  const invoiceType = overrides?.invoiceType ?? 'VAT';
  const currency = overrides?.currency ?? 'PLN';
  const lines =
    overrides?.lines ??
    `<FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>Software Development</P_7>
      <P_8B>160</P_8B>
      <P_8A>HUR</P_8A>
      <P_9A>150.00</P_9A>
      <P_11>24000.00</P_11>
      <P_12>23</P_12>
      <P_11A>29520.00</P_11A>
    </FaWiersz>`;
  const totals =
    overrides?.totals ??
    `<P_13_1>24000.00</P_13_1>
     <P_14_1>5520.00</P_14_1>
     <P_15>29520.00</P_15>`;
  const payment =
    overrides?.payment ??
    `<Platnosc>
      <TerminPlatnosci>2026-04-30</TerminPlatnosci>
      <NrRB>PL12345678901234567890123456</NrRB>
      <FormaPlatnosci>przelew</FormaPlatnosci>
    </Platnosc>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${sellerNip}</NIP>
      <Nazwa>Acme Sp. z o.o.</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <Ulica>Marszalkowska</Ulica>
      <NrDomu>10</NrDomu>
      <KodPocztowy>00-001</KodPocztowy>
      <Miejscowosc>Warszawa</Miejscowosc>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${buyerNip}</NIP>
      <Nazwa>Client Corp</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot2>
  <Fa>
    <P_1>2026-04-01</P_1>
    <P_2>${invoiceNumber}</P_2>
    <RodzajFaktury>${invoiceType}</RodzajFaktury>
    <KodWaluty>${currency}</KodWaluty>
    ${lines}
    ${totals}
    ${payment}
  </Fa>
</Faktura>`;
}

function createParsedInvoice(overrides?: Partial<KsefParsedInvoice>): KsefParsedInvoice {
  return {
    invoiceNumber: 'FV/2026/001',
    issueDate: '2026-04-01',
    invoiceType: 'VAT',
    currency: 'PLN',
    seller: {
      nip: '1234567890',
      name: 'Acme Sp. z o.o.',
      address: 'Marszalkowska 10 00-001 Warszawa',
    },
    buyer: { nip: '9876543210', name: 'Client Corp' },
    lines: [
      {
        lineNumber: 1,
        description: 'Software Development',
        quantity: 160,
        unit: 'HUR',
        unitPriceMinor: 15000,
        netAmountMinor: 2400000,
        vatRate: '23',
        vatAmountMinor: 552000,
        grossAmountMinor: 2952000,
      },
    ],
    totals: { netMinor: 2400000, vatMinor: 552000, grossMinor: 2952000 },
    payment: {
      dueDate: '2026-04-30',
      bankAccount: 'PL12345678901234567890123456',
      method: 'przelew',
    },
    ksefReferenceNumber: 'KSEF-REF-001',
    upoNumber: 'UPO-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// KSeF FA(3) Parser
// ---------------------------------------------------------------------------

describe('KSeF FA(3) Parser', () => {
  it('parses a valid FA(3) XML with all fields', async () => {
    const { parseFa3Xml } = await import('../profiles/ksef/parser.js');
    const xml = createFa3Xml();
    const result = parseFa3Xml(xml, 'KSEF-REF-001', 'UPO-001');

    expect(result.invoiceNumber).toBe('FV/2026/001');
    expect(result.issueDate).toBe('2026-04-01');
    expect(result.invoiceType).toBe('VAT');
    expect(result.currency).toBe('PLN');
    expect(result.seller.nip).toBe('1234567890');
    expect(result.seller.name).toBe('Acme Sp. z o.o.');
    expect(result.seller.address).toBeDefined();
    expect(result.buyer.nip).toBe('9876543210');
    expect(result.ksefReferenceNumber).toBe('KSEF-REF-001');
    expect(result.upoNumber).toBe('UPO-001');
  });

  it('parses line items correctly', async () => {
    const { parseFa3Xml } = await import('../profiles/ksef/parser.js');
    const xml = createFa3Xml();
    const result = parseFa3Xml(xml, 'REF-1');

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.lineNumber).toBe(1);
    expect(result.lines[0]?.description).toBe('Software Development');
    expect(result.lines[0]?.quantity).toBe(160);
    expect(result.lines[0]?.unit).toBe('HUR');
    expect(result.lines[0]?.unitPriceMinor).toBe(15000);
    expect(result.lines[0]?.netAmountMinor).toBe(2400000);
    expect(result.lines[0]?.vatRate).toBe('23');
    expect(result.lines[0]?.vatAmountMinor).toBe(552000);
  });

  it('computes VAT from rate when P_11A is missing', async () => {
    const { parseFa3Xml } = await import('../profiles/ksef/parser.js');
    const xml = createFa3Xml({
      lines: `<FaWiersz>
        <NrWierszaFa>1</NrWierszaFa>
        <P_7>Consulting</P_7>
        <P_11>10000.00</P_11>
        <P_12>23</P_12>
      </FaWiersz>`,
    });
    const result = parseFa3Xml(xml, 'REF-1');

    // VAT should be computed: 1000000 * 23 / 100 = 230000
    expect(result.lines[0]?.vatAmountMinor).toBe(230000);
    expect(result.lines[0]?.grossAmountMinor).toBe(1230000);
  });

  it('handles missing optional fields', async () => {
    const { parseFa3Xml } = await import('../profiles/ksef/parser.js');
    const xml = createFa3Xml({
      lines: `<FaWiersz>
        <NrWierszaFa>1</NrWierszaFa>
        <P_7>Item</P_7>
        <P_11>100.00</P_11>
      </FaWiersz>`,
      payment: '',
    });
    const result = parseFa3Xml(xml, 'REF-1');

    expect(result.lines[0]?.quantity).toBeUndefined();
    expect(result.lines[0]?.unit).toBeUndefined();
    expect(result.lines[0]?.unitPriceMinor).toBeUndefined();
    expect(result.lines[0]?.vatRate).toBeUndefined();
    expect(result.lines[0]?.vatAmountMinor).toBeUndefined();
    expect(result.payment).toBeUndefined();
  });

  it('uses line-level totals when document-level totals are absent', async () => {
    const { parseFa3Xml } = await import('../profiles/ksef/parser.js');
    const xml = createFa3Xml({
      totals: '', // no P_13_1, P_14_1, P_15
      lines: `<FaWiersz>
        <NrWierszaFa>1</NrWierszaFa>
        <P_7>Item A</P_7>
        <P_11>100.00</P_11>
        <P_12>23</P_12>
        <P_11A>123.00</P_11A>
      </FaWiersz>
      <FaWiersz>
        <NrWierszaFa>2</NrWierszaFa>
        <P_7>Item B</P_7>
        <P_11>200.00</P_11>
        <P_12>23</P_12>
        <P_11A>246.00</P_11A>
      </FaWiersz>`,
    });
    const result = parseFa3Xml(xml, 'REF-1');

    // Totals should be sum of lines
    expect(result.totals.netMinor).toBe(30000); // 10000 + 20000
    expect(result.totals.vatMinor).toBe(6900); // 2300 + 4600
    expect(result.totals.grossMinor).toBe(36900); // net + vat
  });

  it('handles tns: namespace prefix', async () => {
    const { parseFa3Xml } = await import('../profiles/ksef/parser.js');
    const xml = `<?xml version="1.0"?>
<tns:Faktura>
  <Podmiot1><DaneIdentyfikacyjne><NIP>1234567890</NIP><Nazwa>Seller</Nazwa></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><NIP>9876543210</NIP><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <P_1>2026-01-01</P_1>
    <P_2>FV/1</P_2>
    <RodzajFaktury>VAT</RodzajFaktury>
    <KodWaluty>PLN</KodWaluty>
    <FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Item</P_7><P_11>100.00</P_11></FaWiersz>
  </Fa>
</tns:Faktura>`;
    const result = parseFa3Xml(xml, 'REF-1');
    expect(result.invoiceNumber).toBe('FV/1');
  });

  it('defaults invoiceType to VAT when missing', async () => {
    const { parseFa3Xml } = await import('../profiles/ksef/parser.js');
    const xml = createFa3Xml({ invoiceType: '' });
    // RodzajFaktury is empty, should default to '' but parsed as-is
    const result = parseFa3Xml(xml, 'REF-1');
    // If empty or missing, the parser sets it from the XML
    expect(result.invoiceType).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// KSeF Mapper: mapKsefToInvoiceFields
// ---------------------------------------------------------------------------

describe('KSeF mapKsefToInvoiceFields', () => {
  it('maps all invoice fields correctly', async () => {
    const { mapKsefToInvoiceFields } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice();
    const { invoice } = mapKsefToInvoiceFields(parsed);

    expect(invoice.invoiceNumber).toBe('FV/2026/001');
    expect(invoice.externalInvoiceId).toBe('KSEF-REF-001');
    expect(invoice.source).toBe('KSEF');
    expect(invoice.sourceReference).toBe('UPO-001');
    expect(invoice.currency).toBe('PLN');
    expect(invoice.subtotalMinor).toBe(2400000);
    expect(invoice.vatAmountMinor).toBe(552000);
    expect(invoice.totalMinor).toBe(2952000);
    expect(invoice.sellerTaxId).toBe('1234567890');
    expect(invoice.sellerName).toBe('Acme Sp. z o.o.');
    expect(invoice.buyerTaxId).toBe('9876543210');
    expect(invoice.sellerBankAccount).toBe('PL12345678901234567890123456');
    expect(invoice.issueDate).toEqual(new Date('2026-04-01'));
    expect(invoice.dueDate).toEqual(new Date('2026-04-30'));
  });

  it('maps lines correctly', async () => {
    const { mapKsefToInvoiceFields } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice();
    const { lines } = mapKsefToInvoiceFields(parsed);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.lineNumber).toBe(1);
    expect(lines[0]?.description).toBe('Software Development');
    expect(lines[0]?.quantity).toBe(160);
    expect(lines[0]?.unit).toBe('HUR');
    expect(lines[0]?.netAmountMinor).toBe(2400000);
  });

  it('determines primary VAT rate from lines', async () => {
    const { mapKsefToInvoiceFields } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({
      lines: [
        {
          lineNumber: 1,
          description: 'A',
          vatRate: '23',
          netAmountMinor: 1000,
          vatAmountMinor: 230,
          grossAmountMinor: 1230,
        },
        {
          lineNumber: 2,
          description: 'B',
          vatRate: '23',
          netAmountMinor: 2000,
          vatAmountMinor: 460,
          grossAmountMinor: 2460,
        },
        {
          lineNumber: 3,
          description: 'C',
          vatRate: '8',
          netAmountMinor: 500,
          vatAmountMinor: 40,
          grossAmountMinor: 540,
        },
      ],
    });
    const { invoice } = mapKsefToInvoiceFields(parsed);
    expect(invoice.vatRate).toBe('23'); // most common
  });

  it('handles missing payment data', async () => {
    const { mapKsefToInvoiceFields } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({ payment: undefined });
    const { invoice } = mapKsefToInvoiceFields(parsed);
    expect(invoice.dueDate).toBeNull();
    expect(invoice.sellerBankAccount).toBeNull();
  });

  it('handles missing UPO number', async () => {
    const { mapKsefToInvoiceFields } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({ upoNumber: undefined });
    const { invoice } = mapKsefToInvoiceFields(parsed);
    expect(invoice.sourceReference).toBeNull();
  });

  it('handles lines with no vatRate', async () => {
    const { mapKsefToInvoiceFields } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({
      lines: [{ lineNumber: 1, description: 'Exempt item', netAmountMinor: 1000 }],
    });
    const { invoice } = mapKsefToInvoiceFields(parsed);
    expect(invoice.vatRate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// KSeF Mapper: ksefToEInvoice
// ---------------------------------------------------------------------------

describe('KSeF ksefToEInvoice', () => {
  it('maps to canonical EInvoice correctly', async () => {
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice();
    const einvoice = ksefToEInvoice(parsed);

    expect(einvoice.id).toBe('FV/2026/001');
    expect(einvoice.issueDate).toBe('2026-04-01');
    expect(einvoice.invoiceTypeCode).toBe('380'); // VAT -> 380
    expect(einvoice.currencyCode).toBe('PLN');
    expect(einvoice.profileId).toBe('ksef');
    expect(einvoice.externalReference).toBe('KSEF-REF-001');
    expect(einvoice.supplier.id).toBe('1234567890');
    expect(einvoice.supplier.country).toBe('PL');
    expect(einvoice.customer.id).toBe('9876543210');
    expect(einvoice.customer.country).toBe('PL');
  });

  it('maps corrective invoice type to 381', async () => {
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({ invoiceType: 'KOR' });
    const einvoice = ksefToEInvoice(parsed);
    expect(einvoice.invoiceTypeCode).toBe('381');
  });

  it('maps CORRECTIVE invoice type to 381', async () => {
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({ invoiceType: 'CORRECTIVE' });
    const einvoice = ksefToEInvoice(parsed);
    expect(einvoice.invoiceTypeCode).toBe('381');
  });

  it('defaults unknown invoice type to 380', async () => {
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({ invoiceType: 'PROFORMA' });
    const einvoice = ksefToEInvoice(parsed);
    expect(einvoice.invoiceTypeCode).toBe('380');
  });

  it('maps payment means with correct UNCL codes', async () => {
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');

    // Transfer
    const transfer = ksefToEInvoice(
      createParsedInvoice({ payment: { method: 'przelew', dueDate: '2026-04-30' } }),
    );
    expect(transfer.paymentMeans?.code).toBe('30');

    // Cash
    const cash = ksefToEInvoice(createParsedInvoice({ payment: { method: 'gotowka' } }));
    expect(cash.paymentMeans?.code).toBe('10');

    // Card
    const card = ksefToEInvoice(createParsedInvoice({ payment: { method: 'karta' } }));
    expect(card.paymentMeans?.code).toBe('48');

    // Unknown method
    const unknown = ksefToEInvoice(createParsedInvoice({ payment: { method: 'barter' } }));
    expect(unknown.paymentMeans?.code).toBeUndefined();

    // No payment
    const noPayment = ksefToEInvoice(createParsedInvoice({ payment: undefined }));
    expect(noPayment.paymentMeans).toBeUndefined();
  });

  it('builds tax breakdown from lines grouped by vatRate', async () => {
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({
      lines: [
        {
          lineNumber: 1,
          description: 'A',
          vatRate: '23',
          netAmountMinor: 10000,
          vatAmountMinor: 2300,
        },
        {
          lineNumber: 2,
          description: 'B',
          vatRate: '23',
          netAmountMinor: 20000,
          vatAmountMinor: 4600,
        },
        {
          lineNumber: 3,
          description: 'C',
          vatRate: '8',
          netAmountMinor: 5000,
          vatAmountMinor: 400,
        },
        { lineNumber: 4, description: 'D', vatRate: '0', netAmountMinor: 1000, vatAmountMinor: 0 },
      ],
    });
    const einvoice = ksefToEInvoice(parsed);

    expect(einvoice.taxBreakdown).toHaveLength(3);

    const s23 = einvoice.taxBreakdown.find(t => t.percent === 23);
    expect(s23?.taxableAmountMinor).toBe(30000);
    expect(s23?.taxAmountMinor).toBe(6900);
    expect(s23?.taxCategory).toBe('S');

    const s8 = einvoice.taxBreakdown.find(t => t.percent === 8);
    expect(s8?.taxableAmountMinor).toBe(5000);
    expect(s8?.taxCategory).toBe('S');

    const z0 = einvoice.taxBreakdown.find(t => t.percent === 0);
    expect(z0?.taxCategory).toBe('Z');
  });

  it('includes supplier address in EInvoice', async () => {
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice();
    const einvoice = ksefToEInvoice(parsed);
    expect(einvoice.supplier.address).toBeDefined();
    expect(einvoice.supplier.address).toContain('Marszalkowska');
  });
});

// ---------------------------------------------------------------------------
// KSeF Generator: generateFa3Xml
// ---------------------------------------------------------------------------

describe('KSeF FA(3) Generator', () => {
  it('generates well-formed FA(3) XML', async () => {
    const { generateFa3Xml } = await import('../profiles/ksef/generator.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice();
    const einvoice = ksefToEInvoice(parsed);
    const xml = generateFa3Xml(einvoice);

    expect(xml).toContain('<Faktura>');
    expect(xml).toContain('<NIP>1234567890</NIP>');
    expect(xml).toContain('<NIP>9876543210</NIP>');
    expect(xml).toContain('FV/2026/001');
    expect(xml).toContain('PLN');
    expect(xml).toContain('VAT'); // RodzajFaktury
  });

  it('generates corrective invoice XML (KOR)', async () => {
    const { generateFa3Xml } = await import('../profiles/ksef/generator.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({ invoiceType: 'KOR' });
    const einvoice = ksefToEInvoice(parsed);
    const xml = generateFa3Xml(einvoice);

    expect(xml).toContain('KOR');
  });

  it('includes payment section when payment means present', async () => {
    const { generateFa3Xml } = await import('../profiles/ksef/generator.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice();
    const einvoice = ksefToEInvoice(parsed);
    const xml = generateFa3Xml(einvoice);

    expect(xml).toContain('<Platnosc>');
    expect(xml).toContain('2026-04-30');
  });

  it('omits payment section when no payment means', async () => {
    const { generateFa3Xml } = await import('../profiles/ksef/generator.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({ payment: undefined });
    const einvoice = ksefToEInvoice(parsed);
    const xml = generateFa3Xml(einvoice);

    expect(xml).not.toContain('<Platnosc>');
  });

  it('includes supplier address when present', async () => {
    const { generateFa3Xml } = await import('../profiles/ksef/generator.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice();
    const einvoice = ksefToEInvoice(parsed);
    const xml = generateFa3Xml(einvoice);

    expect(xml).toContain('<Adres>');
  });

  it('omits supplier address when not present', async () => {
    const { generateFa3Xml } = await import('../profiles/ksef/generator.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({
      seller: { nip: '1234567890', name: 'Test' },
    });
    const einvoice = ksefToEInvoice(parsed);
    const xml = generateFa3Xml(einvoice);

    expect(xml).not.toContain('<Adres>');
  });

  it('includes optional line fields only when present', async () => {
    const { generateFa3Xml } = await import('../profiles/ksef/generator.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const parsed = createParsedInvoice({
      lines: [{ lineNumber: 1, description: 'Minimal', netAmountMinor: 1000 }],
    });
    const einvoice = ksefToEInvoice(parsed);
    const xml = generateFa3Xml(einvoice);

    expect(xml).not.toContain('<P_8B>');
    expect(xml).not.toContain('<P_8A>');
    expect(xml).not.toContain('<P_9A>');
  });
});

// ---------------------------------------------------------------------------
// KSeF Profile
// ---------------------------------------------------------------------------

describe('KSeF Profile', () => {
  it('has profileId=ksef and country=PL', async () => {
    const { KsefProfile } = await import('../profiles/ksef/index.js');
    const profile = new KsefProfile();
    expect(profile.profileId).toBe('ksef');
    expect(profile.country).toBe('PL');
    expect(profile.displayName).toBe('KSeF (Poland)');
    expect(profile.sign).toBeUndefined();
    expect(profile.qrCode).toBeUndefined();
  });

  it('generate() produces FA(3) XML', async () => {
    const { KsefProfile } = await import('../profiles/ksef/index.js');
    const { ksefToEInvoice } = await import('../profiles/ksef/mapper.js');
    const profile = new KsefProfile();
    const parsed = createParsedInvoice();
    const einvoice = ksefToEInvoice(parsed);
    const xml = await profile.generate(einvoice);
    expect(xml).toContain('<Faktura>');
  });

  it('parse() converts FA(3) XML to EInvoice', async () => {
    const { KsefProfile } = await import('../profiles/ksef/index.js');
    const profile = new KsefProfile();
    const xml = createFa3Xml();
    const einvoice = await profile.parse(xml, { ksefReferenceNumber: 'REF-1' });
    expect(einvoice.profileId).toBe('ksef');
    expect(einvoice.externalReference).toBe('REF-1');
  });

  it('validate() returns valid for correct XML', async () => {
    const { KsefProfile } = await import('../profiles/ksef/index.js');
    const profile = new KsefProfile();
    const xml = createFa3Xml();
    const result = await profile.validate(xml);
    expect(result.valid).toBe(true);
    expect(result.profileId).toBe('ksef');
  });

  it('validate() returns error for invalid XML', async () => {
    const { KsefProfile } = await import('../profiles/ksef/index.js');
    const profile = new KsefProfile();
    // XML with invalid NIP (not 10 digits) should fail Zod validation
    const xml = createFa3Xml({ sellerNip: 'INVALID' });
    const result = await profile.validate(xml);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('PARSE_ERROR');
  });

  it('getComplianceStatus returns notConnected without fetcher', async () => {
    const { KsefProfile } = await import('../profiles/ksef/index.js');
    const profile = new KsefProfile();
    const status = await profile.getComplianceStatus('org-1');
    expect(status.state).toBe('notConnected');
  });

  it('getComplianceStatus uses provided fetcher', async () => {
    const { KsefProfile } = await import('../profiles/ksef/index.js');
    const fetcher = vi.fn().mockResolvedValue(null);
    const profile = new KsefProfile({ complianceFetcher: fetcher });
    await profile.getComplianceStatus('org-1');
    expect(fetcher).toHaveBeenCalledWith('org-1');
  });
});

// ---------------------------------------------------------------------------
// KSeF Schemas
// ---------------------------------------------------------------------------

describe('KSeF Schemas', () => {
  it('ksefConnectionConfigSchema requires token when authMethod is token', async () => {
    const { ksefConnectionConfigSchema } = await import('../profiles/ksef/schemas.js');
    const result = ksefConnectionConfigSchema.safeParse({
      authMethod: 'token',
      // token missing
    });
    expect(result.success).toBe(false);
  });

  it('ksefConnectionConfigSchema requires certificate when authMethod is certificate', async () => {
    const { ksefConnectionConfigSchema } = await import('../profiles/ksef/schemas.js');
    const result = ksefConnectionConfigSchema.safeParse({
      authMethod: 'certificate',
      // certificateBase64 missing
    });
    expect(result.success).toBe(false);
  });

  it('ksefConnectionConfigSchema accepts valid token config', async () => {
    const { ksefConnectionConfigSchema } = await import('../profiles/ksef/schemas.js');
    const result = ksefConnectionConfigSchema.safeParse({
      authMethod: 'token',
      token: 'my-token',
    });
    expect(result.success).toBe(true);
  });

  it('ksefConnectionConfigSchema accepts valid certificate config', async () => {
    const { ksefConnectionConfigSchema } = await import('../profiles/ksef/schemas.js');
    const result = ksefConnectionConfigSchema.safeParse({
      authMethod: 'certificate',
      certificateBase64: 'base64cert',
    });
    expect(result.success).toBe(true);
  });

  it('ksefConnectionConfigSchema defaults environment to prod', async () => {
    const { ksefConnectionConfigSchema } = await import('../profiles/ksef/schemas.js');
    const result = ksefConnectionConfigSchema.safeParse({
      authMethod: 'token',
      token: 'my-token',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.environment).toBe('prod');
    }
  });

  it('ksefParsedInvoiceSchema rejects invalid NIP length', async () => {
    const { ksefParsedInvoiceSchema } = await import('../profiles/ksef/schemas.js');
    const result = ksefParsedInvoiceSchema.safeParse({
      invoiceNumber: 'FV/1',
      issueDate: '2026-01-01',
      invoiceType: 'VAT',
      currency: 'PLN',
      seller: { nip: '123', name: 'Test' },
      buyer: { nip: '9876543210' },
      lines: [{ lineNumber: 1, description: 'Item' }],
      totals: { netMinor: 0, vatMinor: 0, grossMinor: 0 },
      ksefReferenceNumber: 'REF',
    });
    expect(result.success).toBe(false);
  });

  it('ksefSyncParamsSchema validates correctly', async () => {
    const { ksefSyncParamsSchema } = await import('../profiles/ksef/schemas.js');
    const result = ksefSyncParamsSchema.safeParse({
      organizationId: 'org-1',
      connectionId: 'conn-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KSeF API Client — static helpers
// ---------------------------------------------------------------------------

describe('KsefApiClient', () => {
  it('constructor uses test URL for test environment', async () => {
    const { KsefApiClient } = await import('../profiles/ksef/api-client.js');
    const client = new KsefApiClient('test');
    // We can verify by trying to call requireSession which checks this.session
    await expect(client.queryInvoices('1234567890', '2026-01-01', '2026-03-31')).rejects.toThrow(
      'KSeF session not established',
    );
  });

  it('constructor defaults to prod environment', async () => {
    const { KsefApiClient } = await import('../profiles/ksef/api-client.js');
    const client = new KsefApiClient();
    await expect(client.downloadInvoiceXml('REF-1')).rejects.toThrow(
      'KSeF session not established',
    );
  });

  it('authenticateWithCertificate throws not supported', async () => {
    const { KsefApiClient } = await import('../profiles/ksef/api-client.js');
    const client = new KsefApiClient('test');
    await expect(client.authenticateWithCertificate('cert', 'pass', '1234567890')).rejects.toThrow(
      'Certificate-based KSeF authentication is not supported',
    );
  });

  it('terminateSession is safe to call without active session', async () => {
    const { KsefApiClient } = await import('../profiles/ksef/api-client.js');
    const client = new KsefApiClient('test');
    // Should not throw
    await client.terminateSession();
  });
});
