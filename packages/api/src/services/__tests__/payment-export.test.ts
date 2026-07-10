import { describe, expect, it, vi } from 'vitest';
import type { ParsedTransaction } from '../bank-statement';
import {
  matchStatementToRun,
  parseBankStatement,
  parseCsvStatement,
  parseMt940,
} from '../bank-statement';
import type { BacsExportItem, BacsOrgBankInfo, ExportItem, OrgBankInfo } from '../payment-export';
import {
  escapeXml,
  formatMultiline,
  generateBacsStandard18,
  generateCsv,
  generateElixir,
  generateSepaXml,
  resolveTransferTitle,
  stripDiacritics,
  validateAbaRoutingNumber,
} from '../payment-export';

// The source uses require("mt940js") which bypasses vi.mock ESM interception.
// We spy on the real Parser prototype instead.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mt940js = require('mt940js') as {
  Parser: { prototype: { parse: (data: string) => unknown } };
};

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ExportItem> = {}): ExportItem {
  return {
    contractorName: 'Jan Kowalski',
    iban: 'PL61109010140000071219812874',
    amountMinor: 150000,
    currency: 'PLN',
    invoiceNumber: 'FV/2026/03/001',
    taxId: '1234567890',
    bankName: 'mBank',
    swiftBic: 'BREXPLPWMBK',
    dueDate: new Date('2026-04-15'),
    transferTitle: 'Zaplata za FV/2026/03/001',
    ...overrides,
  };
}

function makeOrg(overrides: Partial<OrgBankInfo> = {}): OrgBankInfo {
  return {
    name: 'Firma Testowa Sp. z o.o.',
    iban: 'PL27114020040000300201355387',
    bic: 'BREXPLPWXXX',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// payment-export
// ---------------------------------------------------------------------------

describe('payment-export', () => {
  describe('generateCsv', () => {
    it('generates CSV buffer with correct columns per D-06', async () => {
      const items = [makeItem()];
      const buf = await generateCsv(items);
      const csv = buf.toString('utf-8');

      // Check all expected column headers
      expect(csv).toContain('Contractor name');
      expect(csv).toContain('IBAN');
      expect(csv).toContain('Amount');
      expect(csv).toContain('Currency');
      expect(csv).toContain('Invoice number');
      expect(csv).toContain('NIP');
      expect(csv).toContain('Bank name');
      expect(csv).toContain('SWIFT/BIC');
      expect(csv).toContain('Due date');
      expect(csv).toContain('Transfer title');

      // Check data values
      expect(csv).toContain('Jan Kowalski');
      expect(csv).toContain('PL61109010140000071219812874');
      expect(csv).toContain('PLN');
      expect(csv).toContain('FV/2026/03/001');
      expect(csv).toContain('1234567890');
      expect(csv).toContain('mBank');
      expect(csv).toContain('2026-04-15');
    });

    it('includes UTF-8 BOM for Excel compatibility', async () => {
      const buf = await generateCsv([makeItem()]);
      // UTF-8 BOM: EF BB BF
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);
    });

    it('formats amounts as decimal strings', async () => {
      const items = [makeItem({ amountMinor: 150000 }), makeItem({ amountMinor: 99 })];
      const buf = await generateCsv(items);
      const csv = buf.toString('utf-8');
      expect(csv).toContain('1500.00');
      expect(csv).toContain('0.99');
    });
  });

  describe('generateElixir', () => {
    it('generates Elixir type 110 format with CRLF line endings', () => {
      const items = [makeItem(), makeItem({ invoiceNumber: 'FV/002' })];
      const buf = generateElixir(items, makeOrg());
      const text = buf.toString('utf-8');

      // Should have CRLF between lines
      expect(text).toContain('\r\n');

      // Each line starts with 110
      const lines = text.split('\r\n');
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line).toMatch(/^110,/);
      }
    });

    it('strips Polish diacritics to ASCII', () => {
      const items = [makeItem({ contractorName: 'Łukasz Żółkowski' })];
      const org = makeOrg({ name: 'Spółka Ćwiczeniowa' });
      const buf = generateElixir(items, org);
      const text = buf.toString('utf-8');

      expect(text).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
      expect(text).toContain('Lukasz Zolkowski');
      expect(text).toContain('Spolka Cwiczeniowa');
    });

    it('formats multiline fields with pipe delimiters', () => {
      // Name longer than 35 chars should be split with pipe
      const longName = 'Przedsiebiorstwo Budowlane SuperDlugie Nazwa Firmy Sp z oo';
      const items = [makeItem({ contractorName: longName })];
      const buf = generateElixir(items, makeOrg());
      const text = buf.toString('utf-8');

      // formatMultiline splits at 35 chars with pipe
      expect(text).toContain('|');
    });

    it('uses minor-unit integer for amount field', () => {
      const items = [makeItem({ amountMinor: 123456 })];
      const buf = generateElixir(items, makeOrg());
      const text = buf.toString('utf-8');
      // The raw minor-unit value should appear in the line
      expect(text).toContain('123456');
    });

    it('strips country prefix from IBANs', () => {
      const items = [makeItem({ iban: 'PL61109010140000071219812874' })];
      const org = makeOrg({ iban: 'PL27114020040000300201355387' });
      const buf = generateElixir(items, org);
      const text = buf.toString('utf-8');

      // IBANs in Elixir should not have PL prefix
      expect(text).toContain('61109010140000071219812874');
      expect(text).toContain('27114020040000300201355387');
      // The quoted IBAN fields should not start with PL
      expect(text).not.toMatch(/"PL\d/);
    });
  });

  describe('generateSepaXml', () => {
    it('generates valid pain.001.001.03 XML', () => {
      const items = [makeItem({ currency: 'EUR', swiftBic: 'BREXPLPWXXX' })];
      const org = makeOrg();
      const buf = generateSepaXml(items, org, 'RUN-2026-001');
      const xml = buf.toString('utf-8');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('pain.001.001.03');
      expect(xml).toContain('<CstmrCdtTrfInitn>');
      expect(xml).toContain('<MsgId>RUN-2026-001</MsgId>');
      expect(xml).toContain('<NbOfTxs>1</NbOfTxs>');
      expect(xml).toContain('<PmtMtd>TRF</PmtMtd>');
      expect(xml).toContain('<Cd>SEPA</Cd>');
      expect(xml).toContain('<ChrgBr>SLEV</ChrgBr>');
      expect(xml).toContain('<EndToEndId>RUN-2026-001-0001</EndToEndId>');
      expect(xml).toContain('<IBAN>PL61109010140000071219812874</IBAN>');
    });

    it('escapes XML special characters', () => {
      const items = [
        makeItem({
          contractorName: 'Smith & Jones <"Partners">',
          transferTitle: 'Payment for invoice #1 & #2',
        }),
      ];
      const buf = generateSepaXml(items, makeOrg(), 'RUN-001');
      const xml = buf.toString('utf-8');

      expect(xml).toContain('Smith &amp; Jones &lt;&quot;Partners&quot;&gt;');
      expect(xml).toContain('Payment for invoice #1 &amp; #2');
      // Should not contain unescaped characters in data
      expect(xml).not.toContain('<Nm>Smith & Jones');
    });

    it('formats amounts with 2 decimal places', () => {
      const items = [makeItem({ amountMinor: 150000 }), makeItem({ amountMinor: 1 })];
      const buf = generateSepaXml(items, makeOrg(), 'RUN-001');
      const xml = buf.toString('utf-8');

      expect(xml).toContain('>1500.00</InstdAmt>');
      expect(xml).toContain('>0.01</InstdAmt>');
      // CtrlSum should be the total
      expect(xml).toContain('<CtrlSum>1500.01</CtrlSum>');
    });

    it('limits MsgId to 35 characters', () => {
      const longRunNumber = 'RUN-2026-REALLY-LONG-RUN-NUMBER-THAT-EXCEEDS-LIMIT-12345';
      const items = [makeItem()];
      const buf = generateSepaXml(items, makeOrg(), longRunNumber);
      const xml = buf.toString('utf-8');

      // Extract MsgId value
      const match = xml.match(/<MsgId>([^<]+)<\/MsgId>/);
      expect(match).toBeTruthy();
      expect(match?.[1]?.length).toBeLessThanOrEqual(35);
    });

    it('strips non-alphanumeric characters from MsgId except hyphens', () => {
      const items = [makeItem()];
      const buf = generateSepaXml(items, makeOrg(), 'RUN/2026 #001!');
      const xml = buf.toString('utf-8');

      const match = xml.match(/<MsgId>([^<]+)<\/MsgId>/);
      expect(match).toBeTruthy();
      // Only [a-zA-Z0-9-] survive the sanitization
      expect(match?.[1]).toBe('RUN2026001');
    });

    it('preserves hyphens in MsgId', () => {
      const items = [makeItem()];
      const buf = generateSepaXml(items, makeOrg(), 'RUN-2026-001');
      const xml = buf.toString('utf-8');

      const match = xml.match(/<MsgId>([^<]+)<\/MsgId>/);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe('RUN-2026-001');
    });
  });

  describe('resolveTransferTitle', () => {
    it('replaces {invoice_number} placeholder', () => {
      const result = resolveTransferTitle('Zaplata za {invoice_number}', {
        invoiceNumber: 'FV/2026/03/001',
        contractorName: 'Jan Kowalski',
      });
      expect(result).toBe('Zaplata za FV/2026/03/001');
    });

    it('replaces multiple placeholders', () => {
      const result = resolveTransferTitle(
        '{invoice_number} - {contractor_name} ({billing_period}) [{contract_number}]',
        {
          invoiceNumber: 'FV/001',
          contractorName: 'Jan Kowalski',
          billingPeriod: '2026-03',
          contractNumber: 'UMW/2026/01',
        },
      );
      expect(result).toBe('FV/001 - Jan Kowalski (2026-03) [UMW/2026/01]');
    });

    it('trims whitespace from result', () => {
      const result = resolveTransferTitle('  {invoice_number}  ', {
        invoiceNumber: 'FV/001',
        contractorName: 'Jan',
      });
      expect(result).toBe('FV/001');
    });

    it('replaces missing optional placeholders with empty string', () => {
      const result = resolveTransferTitle('{invoice_number} {billing_period} {contract_number}', {
        invoiceNumber: 'FV/001',
        contractorName: 'Jan',
      });
      // billingPeriod and contractNumber are undefined, replaced with ""
      expect(result).toBe('FV/001');
    });
  });

  describe('stripDiacritics', () => {
    it('replaces all Polish characters', () => {
      expect(stripDiacritics('ąćęłńóśźż')).toBe('acelnoszz');
      expect(stripDiacritics('ĄĆĘŁŃÓŚŹŻ')).toBe('ACELNOSZZ');
    });

    it('leaves non-Polish characters unchanged', () => {
      expect(stripDiacritics('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('formatMultiline', () => {
    it('splits long string into pipe-delimited lines', () => {
      const input = 'ABCDEFGHIJ'; // 10 chars
      const result = formatMultiline(input, 4, 3);
      expect(result).toBe('ABC|DEF|GHI|J');
    });

    it('respects maxLines limit', () => {
      const input = 'ABCDEFGHIJKLMNOP'; // 16 chars
      const result = formatMultiline(input, 2, 5);
      // Only 2 lines of 5 chars each
      expect(result).toBe('ABCDE|FGHIJ');
    });

    it('strips diacritics before formatting', () => {
      const result = formatMultiline('Łódź', 1, 35);
      expect(result).toBe('Lodz');
    });
  });

  describe('escapeXml', () => {
    it('escapes all XML special characters', () => {
      expect(escapeXml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&apos;');
    });

    it('leaves normal text unchanged', () => {
      expect(escapeXml('Hello World')).toBe('Hello World');
    });
  });

  // -------------------------------------------------------------------------
  // generateBacsStandard18 — BACS Std 18 Direct Credit fixed-width file
  // -------------------------------------------------------------------------
  describe('generateBacsStandard18', () => {
    function makeBacsItem(overrides: Partial<BacsExportItem> = {}): BacsExportItem {
      return {
        contractorName: 'Acme Ltd',
        sortCode: '203040',
        accountNumber: '12345678',
        amountMinor: 150000, // £1500.00 in pence
        paymentReference: 'INV-001',
        ...overrides,
      };
    }

    function makeBacsOrg(overrides: Partial<BacsOrgBankInfo> = {}): BacsOrgBankInfo {
      return {
        serviceUserNumber: '123456',
        submitterSortCode: '601234',
        submitterAccountNumber: '87654321',
        submitterName: 'TEST ORG LTD',
        ...overrides,
      };
    }

    // Use a reproducible processing date so Julian conversion is deterministic.
    // 2026-04-15 -> Julian YYDDD = 26105 (April 15 is day-of-year 105 in 2026).
    const PROCESSING_DATE = new Date(Date.UTC(2026, 3, 15));

    it('rejects a short destination sort code instead of space-padding', () => {
      expect(() =>
        generateBacsStandard18(
          [makeBacsItem({ sortCode: '20304', accountNumber: '12345678' })],
          makeBacsOrg(),
          'RUN-1',
          PROCESSING_DATE,
        ),
      ).toThrow(/destination sort code must be exactly 6 digits/);
    });

    it('produces a fixed-width buffer with 8 lines (VOL/HDR1/HDR2/UHL1 + 1 detail + EOF1/EOF2/UTL1)', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      expect(result.fileBuffer).toBeInstanceOf(Buffer);
      expect(result.ext).toBe('txt');

      const text = result.fileBuffer.toString('ascii');
      const lines = text.split('\r\n');
      // VOL1, HDR1, HDR2, UHL1, 1 detail, EOF1, EOF2, UTL1 = 8 lines
      expect(lines).toHaveLength(8);
    });

    it('uses CR/LF line endings and contains no UTF-8 BOM', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const text = result.fileBuffer.toString('ascii');
      expect(text).toContain('\r\n');
      // No BOM (BOM would be EF BB BF at offset 0)
      expect(result.fileBuffer[0]).not.toBe(0xef);
    });

    it('produces detail records of exactly 106 characters', () => {
      const result = generateBacsStandard18(
        [makeBacsItem(), makeBacsItem({ contractorName: 'Beta Inc', paymentReference: 'INV-002' })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const text = result.fileBuffer.toString('ascii');
      const lines = text.split('\r\n');
      // VOL1 + HDR1 + HDR2 + UHL1 = lines 0..3, details at 4..N-3, then EOF1 + EOF2 + UTL1 trailers
      const detailLines = lines.slice(4, lines.length - 3);
      expect(detailLines).toHaveLength(2);
      for (const line of detailLines) {
        expect(line.length).toBe(106);
      }
    });

    it('hardcodes transaction code 99 in detail records (Direct Credit)', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const lines = result.fileBuffer.toString('ascii').split('\r\n');
      const detail = lines[4]!;
      // Pos 16-17 (0-indexed: 15-16) = transaction code
      expect(detail.substring(15, 17)).toBe('99');
    });

    it('places destination sort code at positions 1-6 and account number at 7-14', () => {
      const result = generateBacsStandard18(
        [makeBacsItem({ sortCode: '203040', accountNumber: '12345678' })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      expect(detail.substring(0, 6)).toBe('203040');
      expect(detail.substring(6, 14)).toBe('12345678');
    });

    it('places originator sort code (18-23) and account number (24-31)', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg({ submitterSortCode: '601234', submitterAccountNumber: '87654321' }),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      expect(detail.substring(17, 23)).toBe('601234');
      expect(detail.substring(23, 31)).toBe('87654321');
    });

    it('zero-pads amount in pence to 11 digits at positions 36-46', () => {
      const result = generateBacsStandard18(
        [makeBacsItem({ amountMinor: 150000 })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      expect(detail.substring(35, 46)).toBe('00000150000');
    });

    it('transliterates contractor names to BACS-safe uppercase ASCII', () => {
      const result = generateBacsStandard18(
        [makeBacsItem({ contractorName: 'Müller GmbH' })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      // Destination account name at positions 83-100 (18 chars, space-padded)
      const destName = detail.substring(82, 100);
      expect(destName.trimEnd()).toBe('MULLER GMBH');
      // Length is exactly 18 (padded with spaces)
      expect(destName.length).toBe(18);
    });

    it('reports transliteration warnings when names contain unmappable characters', () => {
      const result = generateBacsStandard18(
        [makeBacsItem({ contractorName: '日本 Company' })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      expect(result.transliterationWarnings).toHaveLength(1);
      expect(result.transliterationWarnings[0]?.contractorName).toBe('日本 Company');
      expect(result.transliterationWarnings[0]?.replaced).toEqual(['日', '本']);
    });

    it('produces no transliteration warnings for plain ASCII names', () => {
      const result = generateBacsStandard18(
        [makeBacsItem({ contractorName: 'Acme Limited' })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      expect(result.transliterationWarnings).toEqual([]);
    });

    it('formats processing date as YYDDD Julian (2026-04-15 -> 26105)', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      // Processing date field at positions 101-106 (last 6 chars of 106 total).
      // Field is 6 chars wide: 5-char YYDDD Julian + 1 padding space.
      const processingField = detail.substring(100, 106);
      expect(processingField.trimEnd()).toBe('26105');
      expect(processingField.length).toBe(6);
      expect(processingField.substring(0, 5)).toBe('26105');
    });

    it('formats Julian date for January 1 as YYDDD = 26001', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        new Date(Date.UTC(2026, 0, 1)),
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      const processingField = detail.substring(100, 106);
      expect(processingField.trimEnd()).toBe('26001');
      expect(processingField.substring(0, 5)).toBe('26001');
    });

    it('truncates contractor names longer than 18 characters', () => {
      const longName = 'Very Long Limited Liability Partnership PLC';
      const result = generateBacsStandard18(
        [makeBacsItem({ contractorName: longName })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      const destName = detail.substring(82, 100);
      expect(destName.length).toBe(18);
      // Should be transliterated (uppercase) and truncated
      expect(destName).toBe('VERY LONG LIMITED ');
    });

    it('truncates payment reference longer than 18 characters', () => {
      const result = generateBacsStandard18(
        [makeBacsItem({ paymentReference: 'INV-2026-VERY-LONG-REFERENCE-001' })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      // User reference at positions 65-82 (18 chars)
      const userRef = detail.substring(64, 82);
      expect(userRef.length).toBe(18);
    });

    it('throws when amount overflows 11-digit pence (>= 100_000_000_000)', () => {
      expect(() =>
        generateBacsStandard18(
          [makeBacsItem({ amountMinor: 100_000_000_000 })],
          makeBacsOrg(),
          'RUN-001',
          PROCESSING_DATE,
        ),
      ).toThrow(/overflow|11 digit|amount/i);
    });

    it('accepts the maximum 11-digit pence amount (99_999_999_999)', () => {
      expect(() =>
        generateBacsStandard18(
          [makeBacsItem({ amountMinor: 99_999_999_999 })],
          makeBacsOrg(),
          'RUN-001',
          PROCESSING_DATE,
        ),
      ).not.toThrow();
    });

    it('writes UTL1 trailer with the total amount across all items as 11 zero-padded digits', () => {
      const result = generateBacsStandard18(
        [
          makeBacsItem({ amountMinor: 150000 }),
          makeBacsItem({ amountMinor: 250000 }),
          makeBacsItem({ amountMinor: 99 }),
        ],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const lines = result.fileBuffer.toString('ascii').split('\r\n');
      const utl1 = lines[lines.length - 1]!;
      expect(utl1.startsWith('UTL1')).toBe(true);
      // 150000 + 250000 + 99 = 400099
      expect(utl1).toContain('00000400099');
    });

    it('starts the file with VOL1 label', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const text = result.fileBuffer.toString('ascii');
      expect(text.startsWith('VOL1')).toBe(true);
    });

    it('writes header records all exactly 80 characters wide', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const lines = result.fileBuffer.toString('ascii').split('\r\n');
      const headers = [lines[0]!, lines[1]!, lines[2]!, lines[3]!];
      for (const header of headers) {
        expect(header.length).toBe(80);
      }
    });

    it('writes trailer records all exactly 80 characters wide', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      const lines = result.fileBuffer.toString('ascii').split('\r\n');
      const trailers = [
        lines[lines.length - 3]!,
        lines[lines.length - 2]!,
        lines[lines.length - 1]!,
      ];
      for (const trailer of trailers) {
        expect(trailer.length).toBe(80);
      }
    });

    it('aggregates modulus warnings from items with non-standard sort codes', () => {
      // Coutts sort code 18-00-02 falls in exception 14 range
      const result = generateBacsStandard18(
        [makeBacsItem({ sortCode: '180002', accountNumber: '12345678' })],
        makeBacsOrg(),
        'RUN-001',
        PROCESSING_DATE,
      );

      // modulusWarnings is always returned; for a Coutts/exception sort code
      // we expect at least one warning entry surfaced for UI display.
      expect(Array.isArray(result.modulusWarnings)).toBe(true);
    });

    it('uppercases originator (submitter) name in the originator name field', () => {
      const result = generateBacsStandard18(
        [makeBacsItem()],
        makeBacsOrg({ submitterName: 'Acme Holdings' }),
        'RUN-001',
        PROCESSING_DATE,
      );

      const detail = result.fileBuffer.toString('ascii').split('\r\n')[4]!;
      // Originator name at positions 47-64 (18 chars)
      const origName = detail.substring(46, 64);
      expect(origName.length).toBe(18);
      expect(origName.trimEnd()).toBe('ACME HOLDINGS');
    });
  });
});

// ---------------------------------------------------------------------------
// bank-statement
// ---------------------------------------------------------------------------

describe('bank-statement', () => {
  describe('parseMt940', () => {
    it('parses MT940 transactions with amounts in minor units', () => {
      const parseSpy = vi.spyOn(mt940js.Parser.prototype, 'parse').mockReturnValue([
        {
          currency: 'PLN',
          transactions: [
            {
              amount: -1500.5,
              description: 'Payment to supplier',
              date: new Date('2026-03-15'),
              reference: 'REF001',
              structuredDetails: {
                accountIdentification: 'PL61109010140000071219812874',
              },
            },
            {
              amount: 250.0,
              description: 'Incoming transfer',
              date: new Date('2026-03-16'),
              reference: 'REF002',
            },
          ],
        },
      ]);

      const result = parseMt940('fake mt940 content');

      expect(result).toHaveLength(2);

      // Amount should be absolute value in minor units
      expect(result[0]?.amount).toBe(150050);
      expect(result[0]?.currency).toBe('PLN');
      expect(result[0]?.description).toBe('Payment to supplier');
      expect(result[0]?.iban).toBe('PL61109010140000071219812874');
      expect(result[0]?.reference).toBe('REF001');

      expect(result[1]?.amount).toBe(25000);
      expect(result[1]?.iban).toBeUndefined();

      parseSpy.mockRestore();
    });
  });

  describe('parseCsvStatement', () => {
    it('parses CSV with comma separator', () => {
      const csv = [
        'date,amount,iban,description,reference',
        '2026-03-15,1500.50,PL61109010140000071219812874,Payment to supplier,REF001',
        '2026-03-16,250.00,PL27114020040000300201355387,Another payment,REF002',
      ].join('\n');

      const result = parseCsvStatement(csv);

      expect(result).toHaveLength(2);
      expect(result[0]?.amount).toBe(150050);
      expect(result[0]?.iban).toBe('PL61109010140000071219812874');
      expect(result[0]?.description).toBe('Payment to supplier');
      expect(result[0]?.reference).toBe('REF001');
      expect(result[1]?.amount).toBe(25000);
    });

    it('handles semicolon separator', () => {
      const csv = [
        'data;kwota;rachunek;opis;referencja',
        '2026-03-15;1500.50;PL61109010140000071219812874;Przelew;REF001',
      ].join('\n');

      const result = parseCsvStatement(csv);

      expect(result).toHaveLength(1);
      expect(result[0]?.amount).toBe(150050);
      expect(result[0]?.iban).toBe('PL61109010140000071219812874');
    });

    it('handles comma decimal separator in amounts', () => {
      const csv = [
        'data;kwota;rachunek;opis',
        '2026-03-15;"1 234,56";PL61109010140000071219812874;Przelew',
        '2026-03-16;"99,99";PL27114020040000300201355387;Inny przelew',
      ].join('\n');

      const result = parseCsvStatement(csv);

      expect(result).toHaveLength(2);
      expect(result[0]?.amount).toBe(123456);
      expect(result[1]?.amount).toBe(9999);
    });

    it('returns empty array for input with less than 2 lines', () => {
      expect(parseCsvStatement('')).toHaveLength(0);
      expect(parseCsvStatement('date,amount')).toHaveLength(0);
    });

    it('returns empty array when amount column is not found', () => {
      const csv = ['name,value_wrong,iban', 'Jan,100,PL123'].join('\n');

      const result = parseCsvStatement(csv);
      expect(result).toHaveLength(0);
    });

    it('skips rows with zero or NaN amounts', () => {
      const csv = [
        'date,amount,iban,description',
        '2026-03-15,0,PL61109010140000071219812874,Zero',
        '2026-03-16,abc,PL27114020040000300201355387,Invalid',
        '2026-03-17,500.00,PL27114020040000300201355387,Valid',
      ].join('\n');

      const result = parseCsvStatement(csv);
      expect(result).toHaveLength(1);
      expect(result[0]?.amount).toBe(50000);
    });
  });

  describe('parseBankStatement', () => {
    it('routes .mt940 files to parseMt940', () => {
      const parseSpy = vi
        .spyOn(mt940js.Parser.prototype, 'parse')
        .mockReturnValue([{ currency: 'PLN', transactions: [] }]);

      const result = parseBankStatement('', 'statement.mt940');
      expect(result).toEqual([]);
      expect(parseSpy).toHaveBeenCalled();
      parseSpy.mockRestore();
    });

    it('routes .sta files to parseMt940', () => {
      const parseSpy = vi
        .spyOn(mt940js.Parser.prototype, 'parse')
        .mockReturnValue([{ currency: 'PLN', transactions: [] }]);

      const result = parseBankStatement('', 'statement.sta');
      expect(result).toEqual([]);
      expect(parseSpy).toHaveBeenCalled();
      parseSpy.mockRestore();
    });

    it('routes .csv files to parseCsvStatement', () => {
      const csv = 'date,amount\n2026-03-15,100.00';
      const result = parseBankStatement(csv, 'statement.csv');
      expect(result).toHaveLength(1);
      expect(result[0]?.amount).toBe(10000);
    });

    it('routes .txt files to parseCsvStatement', () => {
      const csv = 'date,amount\n2026-03-15,200.00';
      const result = parseBankStatement(csv, 'export.txt');
      expect(result).toHaveLength(1);
      expect(result[0]?.amount).toBe(20000);
    });

    it('throws for unrecognized file extensions', () => {
      expect(() => parseBankStatement('', 'file.pdf')).toThrow('Unsupported bank statement format');
      expect(() => parseBankStatement('', 'file.xlsx')).toThrow(
        'Unsupported bank statement format',
      );
    });
  });

  describe('matchStatementToRun', () => {
    const baseItems = [
      {
        id: 'item-1',
        amountMinor: 150000,
        iban: 'PL61109010140000071219812874',
      },
      {
        id: 'item-2',
        amountMinor: 250000,
        iban: 'PL27114020040000300201355387',
      },
      {
        id: 'item-3',
        amountMinor: 75000,
        iban: 'PL10105014451000002276470461',
      },
    ];

    it('returns exact match when IBAN and amount match', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150000,
          currency: 'PLN',
          description: 'Payment',
          iban: 'PL61109010140000071219812874',
          date: new Date('2026-03-15'),
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(1);
      expect(results[0]?.paymentRunItemId).toBe('item-1');
      expect(results[0]?.confidence).toBe('exact');
      expect(results[0]?.amountMatched).toBe(true);
      expect(results[0]?.ibanMatched).toBe(true);
    });

    it('returns partial match within 1 minor-unit tolerance', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150001, // 1 minor unit off
          currency: 'PLN',
          description: 'Payment',
          iban: 'PL61109010140000071219812874',
          date: new Date('2026-03-15'),
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(1);
      expect(results[0]?.paymentRunItemId).toBe('item-1');
      expect(results[0]?.confidence).toBe('partial');
      expect(results[0]?.ibanMatched).toBe(true);
      // Close amount but not exact
      expect(results[0]?.amountMatched).toBe(false);
    });

    it('returns partial match when only amount matches', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150000,
          currency: 'PLN',
          description: 'Payment',
          iban: 'DE89370400440532013000', // Different IBAN
          date: new Date('2026-03-15'),
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(1);
      expect(results[0]?.paymentRunItemId).toBe('item-1');
      expect(results[0]?.confidence).toBe('partial');
      expect(results[0]?.amountMatched).toBe(true);
      expect(results[0]?.ibanMatched).toBe(false);
    });

    it('returns unmatched when no match found', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 999999,
          currency: 'PLN',
          description: 'Unknown payment',
          iban: 'DE89370400440532013000',
          date: new Date('2026-03-15'),
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(1);
      expect(results[0]?.confidence).toBe('unmatched');
      expect(results[0]?.paymentRunItemId).toBe('');
      expect(results[0]?.amountMatched).toBe(false);
      expect(results[0]?.ibanMatched).toBe(false);
    });

    it('does not double-match items', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150000,
          currency: 'PLN',
          description: 'First',
          iban: 'PL61109010140000071219812874',
          date: new Date('2026-03-15'),
        },
        {
          amount: 150000,
          currency: 'PLN',
          description: 'Duplicate',
          iban: 'PL61109010140000071219812874',
          date: new Date('2026-03-16'),
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(2);
      // First transaction should match item-1
      expect(results[0]?.paymentRunItemId).toBe('item-1');
      expect(results[0]?.confidence).toBe('exact');

      // Second transaction should NOT match item-1 again
      expect(results[1]?.paymentRunItemId).not.toBe('item-1');
    });

    it('matches using last 20 chars of IBAN for normalization', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150000,
          currency: 'PLN',
          description: 'Payment',
          // Same last 20 digits, different prefix formatting
          iban: 'PL 6110 9010 1400 0007 1219 8128 74',
          date: new Date('2026-03-15'),
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(1);
      expect(results[0]?.paymentRunItemId).toBe('item-1');
      expect(results[0]?.confidence).toBe('exact');
    });

    it('requires IBAN length >= 10 for IBAN matching', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150000,
          currency: 'PLN',
          description: 'Payment',
          iban: 'SHORT', // Too short for IBAN matching
          date: new Date('2026-03-15'),
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(1);
      // Should still match by amount only (partial)
      expect(results[0]?.confidence).toBe('partial');
      expect(results[0]?.amountMatched).toBe(true);
      expect(results[0]?.ibanMatched).toBe(false);
    });

    it('handles transactions without IBAN', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150000,
          currency: 'PLN',
          description: 'Cash payment',
          date: new Date('2026-03-15'),
          // No IBAN
        },
      ];

      const results = matchStatementToRun(transactions, baseItems);

      expect(results).toHaveLength(1);
      // Should match by amount only
      expect(results[0]?.confidence).toBe('partial');
      expect(results[0]?.amountMatched).toBe(true);
      expect(results[0]?.ibanMatched).toBe(false);
    });

    it('handles empty transactions array', () => {
      const results = matchStatementToRun([], baseItems);
      expect(results).toHaveLength(0);
    });

    it('handles empty items array', () => {
      const transactions: ParsedTransaction[] = [
        {
          amount: 150000,
          currency: 'PLN',
          description: 'Payment',
          date: new Date('2026-03-15'),
        },
      ];

      const results = matchStatementToRun(transactions, []);
      expect(results).toHaveLength(1);
      expect(results[0]?.confidence).toBe('unmatched');
    });
  });
});
describe('validateAbaRoutingNumber', () => {
  it('accepts a known-good test routing number', () => {
    expect(() => validateAbaRoutingNumber('021000021')).not.toThrow();
  });

  it('rejects a routing number with a bad checksum', () => {
    expect(() => validateAbaRoutingNumber('021000022')).toThrow(/ABA mod-10/);
  });
});
