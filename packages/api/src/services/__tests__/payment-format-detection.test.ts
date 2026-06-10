import { describe, expect, it } from 'vitest';
import type { ExportItem } from '../payment-export';
import type { Destination } from '../payment-format-detection';
import {
  detectFormat,
  detectFormatForDestination,
  EU_IBAN_COUNTRIES,
  groupItemsByFormat,
} from '../payment-format-detection';

describe('EU_IBAN_COUNTRIES', () => {
  it('contains all 27 EU + 3 EEA country codes (30 total)', () => {
    expect(EU_IBAN_COUNTRIES.size).toBe(30);
  });

  it('contains DE, FR, PL (EU)', () => {
    expect(EU_IBAN_COUNTRIES.has('DE')).toBe(true);
    expect(EU_IBAN_COUNTRIES.has('FR')).toBe(true);
    expect(EU_IBAN_COUNTRIES.has('PL')).toBe(true);
  });

  it('contains IS, LI, NO (EEA)', () => {
    expect(EU_IBAN_COUNTRIES.has('IS')).toBe(true);
    expect(EU_IBAN_COUNTRIES.has('LI')).toBe(true);
    expect(EU_IBAN_COUNTRIES.has('NO')).toBe(true);
  });

  it('does not contain AE, SA, GB', () => {
    expect(EU_IBAN_COUNTRIES.has('AE')).toBe(false);
    expect(EU_IBAN_COUNTRIES.has('SA')).toBe(false);
    expect(EU_IBAN_COUNTRIES.has('GB')).toBe(false);
  });
});

describe('detectFormat', () => {
  it('EUR + DE IBAN -> "SEPA_XML"', () => {
    expect(detectFormat('EUR', 'DE89370400440532013000')).toBe('SEPA_XML');
  });

  it('EUR + FR IBAN -> "SEPA_XML"', () => {
    expect(detectFormat('EUR', 'FR7630006000011234567890189')).toBe('SEPA_XML');
  });

  it('EUR + PL IBAN -> "SEPA_XML"', () => {
    expect(detectFormat('EUR', 'PL61109010140000071219812874')).toBe('SEPA_XML');
  });

  it('AED + any IBAN -> "SWIFT_XML"', () => {
    expect(detectFormat('AED', 'AE070331234567890123456')).toBe('SWIFT_XML');
  });

  it('SAR + any IBAN -> "SWIFT_XML"', () => {
    expect(detectFormat('SAR', 'SA0380000000608010167519')).toBe('SWIFT_XML');
  });

  it('GBP + GB IBAN -> "SWIFT_XML" (GBP is not SEPA currency)', () => {
    expect(detectFormat('GBP', 'GB29NWBK60161331926819')).toBe('SWIFT_XML');
  });

  it('PLN + PL IBAN -> "BANK_FILE" (domestic Polish transfer)', () => {
    expect(detectFormat('PLN', 'PL61109010140000071219812874')).toBe('BANK_FILE');
  });

  it('EUR + AE IBAN -> "SWIFT_XML" (non-EU IBAN)', () => {
    expect(detectFormat('EUR', 'AE070331234567890123456')).toBe('SWIFT_XML');
  });
});

describe('groupItemsByFormat', () => {
  const makeItem = (currency: string, iban: string): ExportItem => ({
    contractorName: 'Test',
    iban,
    amountMinor: 1000,
    currency,
    invoiceNumber: 'INV-001',
    taxId: null,
    bankName: null,
    swiftBic: null,
    dueDate: new Date('2026-04-15'),
    transferTitle: 'Payment',
  });

  it('groups mixed-currency items correctly', () => {
    const items = [
      makeItem('EUR', 'DE89370400440532013000'),
      makeItem('AED', 'AE070331234567890123456'),
      makeItem('EUR', 'FR7630006000011234567890189'),
      makeItem('PLN', 'PL61109010140000071219812874'),
    ];

    const groups = groupItemsByFormat(items);
    expect(groups.get('SEPA_XML')?.length).toBe(2);
    expect(groups.get('SWIFT_XML')?.length).toBe(1);
    expect(groups.get('BANK_FILE')?.length).toBe(1);
  });

  it('separates PLN domestic from EUR SEPA', () => {
    const items = [
      makeItem('PLN', 'PL61109010140000071219812874'),
      makeItem('EUR', 'PL61109010140000071219812874'),
    ];

    const groups = groupItemsByFormat(items);
    expect(groups.get('BANK_FILE')?.length).toBe(1);
    expect(groups.get('SEPA_XML')?.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// detectFormatForDestination — BACS_STD18 routing for GBP+UK accounts
// ---------------------------------------------------------------------------

describe('detectFormatForDestination', () => {
  function makeDest(overrides: Partial<Destination> = {}): Destination {
    return {
      iban: null,
      ukSortCodeEncrypted: null,
      ukAccountNumberEncrypted: null,
      ...overrides,
    };
  }

  it('routes GBP + UK sort code/account to BACS_STD18', () => {
    const dest = makeDest({
      ukSortCodeEncrypted: 'enc:abc123',
      ukAccountNumberEncrypted: 'enc:def456',
    });
    expect(detectFormatForDestination('GBP', dest)).toBe('BACS_STD18');
  });

  it('routes GBP + UK account BEFORE checking IBAN (BACS takes precedence)', () => {
    // Even if a GB IBAN is present, UK account fields should win.
    const dest = makeDest({
      iban: 'GB29NWBK60161331926819',
      ukSortCodeEncrypted: 'enc:abc',
      ukAccountNumberEncrypted: 'enc:def',
    });
    expect(detectFormatForDestination('GBP', dest)).toBe('BACS_STD18');
  });

  it('routes GBP + IBAN (no UK account) to SWIFT_XML (unchanged behavior)', () => {
    const dest = makeDest({ iban: 'GB29NWBK60161331926819' });
    expect(detectFormatForDestination('GBP', dest)).toBe('SWIFT_XML');
  });

  it('routes EUR + DE IBAN to SEPA_XML (unchanged behavior)', () => {
    const dest = makeDest({ iban: 'DE89370400440532013000' });
    expect(detectFormatForDestination('EUR', dest)).toBe('SEPA_XML');
  });

  it('routes PLN + PL IBAN to BANK_FILE (unchanged behavior)', () => {
    const dest = makeDest({ iban: 'PL61109010140000071219812874' });
    expect(detectFormatForDestination('PLN', dest)).toBe('BANK_FILE');
  });

  it('does NOT route to BACS_STD18 when only sort code is present (account number missing)', () => {
    const dest = makeDest({
      iban: 'GB29NWBK60161331926819',
      ukSortCodeEncrypted: 'enc:abc',
      // ukAccountNumberEncrypted missing
    });
    expect(detectFormatForDestination('GBP', dest)).toBe('SWIFT_XML');
  });

  it('does NOT route to BACS_STD18 when only account number is present (sort code missing)', () => {
    const dest = makeDest({
      iban: 'GB29NWBK60161331926819',
      ukAccountNumberEncrypted: 'enc:def',
      // ukSortCodeEncrypted missing
    });
    expect(detectFormatForDestination('GBP', dest)).toBe('SWIFT_XML');
  });

  it('does NOT route non-GBP currency to BACS_STD18 even with UK account fields', () => {
    const dest = makeDest({
      iban: 'GB29NWBK60161331926819',
      ukSortCodeEncrypted: 'enc:abc',
      ukAccountNumberEncrypted: 'enc:def',
    });
    expect(detectFormatForDestination('EUR', dest)).toBe('SWIFT_XML');
  });

  it('falls back to SWIFT_XML when neither IBAN nor UK account fields are present', () => {
    const dest = makeDest();
    expect(detectFormatForDestination('USD', dest)).toBe('SWIFT_XML');
  });
});
