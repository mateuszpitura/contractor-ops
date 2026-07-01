import { describe, expect, it } from 'vitest';
import type { ExportItem } from '../payment-export';
import type { Destination } from '../payment-format-detection';
import {
  detectFormat,
  detectFormatForDestination,
  detectUsFormat,
  EU_IBAN_COUNTRIES,
  groupItemsByFormat,
  SAME_DAY_ACH_CEILING_MINOR_2027,
  SAME_DAY_ACH_CEILING_MINOR_CURRENT,
  sameDayAchCeilingMinor,
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

// ---------------------------------------------------------------------------
// detectUsFormat — ACH_NACHA / FEDWIRE routing on the Same-Day ACH ceiling
// ---------------------------------------------------------------------------

describe('sameDayAchCeilingMinor', () => {
  it('is $1M (in cents) before 2027-09-17', () => {
    expect(sameDayAchCeilingMinor(new Date('2026-07-01T00:00:00Z'))).toBe(
      SAME_DAY_ACH_CEILING_MINOR_CURRENT,
    );
    expect(SAME_DAY_ACH_CEILING_MINOR_CURRENT).toBe(1_000_000_00);
  });

  it('rises to $10M (in cents) on 2027-09-17', () => {
    expect(sameDayAchCeilingMinor(new Date('2027-09-17T00:00:00Z'))).toBe(
      SAME_DAY_ACH_CEILING_MINOR_2027,
    );
    expect(sameDayAchCeilingMinor(new Date('2028-01-01T00:00:00Z'))).toBe(
      SAME_DAY_ACH_CEILING_MINOR_2027,
    );
    expect(SAME_DAY_ACH_CEILING_MINOR_2027).toBe(10_000_000_00);
  });
});

describe('detectUsFormat', () => {
  const ceiling = SAME_DAY_ACH_CEILING_MINOR_CURRENT;

  it('returns null when the currency is not USD', () => {
    expect(detectUsFormat('EUR', true, 50_000_00, ceiling)).toBeNull();
  });

  it('returns null when the destination is not a US bank', () => {
    expect(detectUsFormat('USD', false, 50_000_00, ceiling)).toBeNull();
  });

  it('routes USD + US bank at or below the ceiling to ACH_NACHA', () => {
    expect(detectUsFormat('USD', true, 50_000_00, ceiling)).toBe('ACH_NACHA');
    // Exactly at the ceiling is NOT above it — still ACH.
    expect(detectUsFormat('USD', true, ceiling, ceiling)).toBe('ACH_NACHA');
  });

  it('routes USD + US bank ABOVE the ceiling to FEDWIRE (boundary flips at ceiling + 1)', () => {
    expect(detectUsFormat('USD', true, ceiling + 1, ceiling)).toBe('FEDWIRE');
    expect(detectUsFormat('USD', true, 5_000_000_00, ceiling)).toBe('FEDWIRE');
  });

  it('honors a raised ceiling supplied as config (the $10M 2027 value keeps a $5M payout on ACH)', () => {
    expect(detectUsFormat('USD', true, 5_000_000_00, SAME_DAY_ACH_CEILING_MINOR_2027)).toBe(
      'ACH_NACHA',
    );
  });
});

// ---------------------------------------------------------------------------
// detectFormatForDestination — US-bank routing precedence
//
// A USD payout to a US bank (routing/account present, no IBAN) must resolve to
// ACH_NACHA at/below the Same-Day ACH ceiling and FEDWIRE above it, checked
// BETWEEN the BACS rail and the IBAN fallback. The amount is carried in an
// options arg; the pre-existing BACS/SEPA/SWIFT precedence must not regress.
// ---------------------------------------------------------------------------

describe('detectFormatForDestination — US ACH/Fedwire routing', () => {
  const ceiling = SAME_DAY_ACH_CEILING_MINOR_CURRENT;

  // A US-bank destination: encrypted routing + account present, no IBAN, no UK pair.
  const usBankDestination = {
    iban: null,
    ukSortCodeEncrypted: null,
    ukAccountNumberEncrypted: null,
    usRoutingNumberEncrypted: 'enc:123456789',
    usAccountNumberEncrypted: 'enc:000987654321',
  };

  it('routes a USD US-bank payout at or below the ceiling to ACH_NACHA', () => {
    expect(detectFormatForDestination('USD', usBankDestination, { amountMinor: 50_000_00 })).toBe(
      'ACH_NACHA',
    );
    expect(detectFormatForDestination('USD', usBankDestination, { amountMinor: ceiling })).toBe(
      'ACH_NACHA',
    );
  });

  it('routes a USD US-bank payout above the ceiling to FEDWIRE', () => {
    expect(detectFormatForDestination('USD', usBankDestination, { amountMinor: ceiling + 1 })).toBe(
      'FEDWIRE',
    );
  });

  it('keeps GBP + UK sort/account on BACS_STD18 (US branch never shadows BACS)', () => {
    const gbpUkDestination = {
      iban: 'GB29NWBK60161331926819',
      ukSortCodeEncrypted: 'enc:abc',
      ukAccountNumberEncrypted: 'enc:def',
    };
    expect(detectFormatForDestination('GBP', gbpUkDestination)).toBe('BACS_STD18');
  });

  it('keeps EUR + EU IBAN on SEPA_XML (no US regression)', () => {
    const eurDestination = {
      iban: 'DE89370400440532013000',
      ukSortCodeEncrypted: null,
      ukAccountNumberEncrypted: null,
    };
    expect(detectFormatForDestination('EUR', eurDestination)).toBe('SEPA_XML');
  });

  it('falls through to SWIFT_XML for a US-bank destination when no amount is supplied', () => {
    // Without an amount the US branch cannot pick a rail, so routing must fall
    // straight through to the IBAN fallback rather than silently defaulting to ACH.
    expect(detectFormatForDestination('USD', usBankDestination)).toBe('SWIFT_XML');
  });
});

// ---------------------------------------------------------------------------
// groupItemsByFormat — US-aware split
//
// A mixed run (a USD US-bank item at/below the ceiling, a USD US-bank item above
// it, and a EUR EU-IBAN item) must split into ACH_NACHA + FEDWIRE + SEPA_XML.
// ---------------------------------------------------------------------------

describe('groupItemsByFormat — US-aware split', () => {
  const makeUsItem = (amountMinor: number): ExportItem => ({
    contractorName: 'US Payee',
    iban: '',
    amountMinor,
    currency: 'USD',
    invoiceNumber: 'INV-US',
    taxId: null,
    bankName: null,
    swiftBic: null,
    dueDate: new Date('2026-06-01'),
    transferTitle: 'Payment',
    usRoutingNumber: '123456789',
    usAccountNumber: '000987654321',
  });

  const eurItem: ExportItem = {
    contractorName: 'EU Payee',
    iban: 'DE89370400440532013000',
    amountMinor: 25_000_00,
    currency: 'EUR',
    invoiceNumber: 'INV-EU',
    taxId: null,
    bankName: null,
    swiftBic: null,
    dueDate: new Date('2026-06-01'),
    transferTitle: 'Payment',
  };

  it('splits a mixed USD-US-bank / EUR-IBAN run into ACH_NACHA + FEDWIRE + SEPA_XML', () => {
    const groups = groupItemsByFormat([
      makeUsItem(50_000_00),
      makeUsItem(SAME_DAY_ACH_CEILING_MINOR_CURRENT + 1),
      eurItem,
    ]);

    expect(groups.get('ACH_NACHA')?.length).toBe(1);
    expect(groups.get('FEDWIRE')?.length).toBe(1);
    expect(groups.get('SEPA_XML')?.length).toBe(1);
  });
});
