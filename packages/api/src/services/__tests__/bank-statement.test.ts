import { describe, expect, it } from 'vitest';
import type { ParsedTransaction } from '../bank-statement';
import {
  matchStatementToRun,
  parseBankStatement,
  parseCsvStatement,
  parseMt940,
} from '../bank-statement';

/** Minimal MT940 snippet compatible with mt940js Parser */
const SAMPLE_MT940 = `:20:12345
:25:PL61109010140000071219812874
:28C:0/1
:60F:C240101PLN100000,00
:61:2401020100D10000,00NMSCNONREF
:86:999?00Test payment
:62F:C240102PLN90000,00
-
`;

describe('parseMt940', () => {
  it('extracts transactions with PLN currency and minor-unit amount', () => {
    const rows = parseMt940(SAMPLE_MT940);
    expect(rows.length).toBe(1);
    expect(rows[0]?.currency).toBe('PLN');
    expect(rows[0]?.amount).toBe(1_000_000);
    expect(rows[0]?.description).toBe('');
  });
});

describe('parseCsvStatement', () => {
  it('returns empty array for fewer than 2 lines', () => {
    expect(parseCsvStatement('header only')).toEqual([]);
    expect(parseCsvStatement('')).toEqual([]);
  });

  it('returns empty when amount column cannot be detected', () => {
    const csv = 'foo;bar\n1;2';
    expect(parseCsvStatement(csv)).toEqual([]);
  });

  it('parses semicolon-delimited Polish-style amounts', () => {
    const csv = `amount;description
123,45;Wire from client
`;
    const rows = parseCsvStatement(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(12345);
    expect(rows[0]?.currency).toBe('PLN');
    expect(rows[0]?.description).toBe('Wire from client');
  });

  it('parses comma-delimited CSV with quoted fields', () => {
    const csv = `amount,iban,date
100.50,PL61109010140000071219812874,2024-01-15
`;
    const rows = parseCsvStatement(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(10050);
    expect(rows[0]?.iban).toBe('PL61109010140000071219812874');
  });
});

describe('parseBankStatement', () => {
  it('routes .mt940 through MT940 parser', () => {
    const rows = parseBankStatement(SAMPLE_MT940, 'stmt.mt940');
    expect(rows.length).toBe(1);
    expect(rows[0]?.currency).toBe('PLN');
  });

  it('routes .sta extension to MT940 parser', () => {
    const rows = parseBankStatement(SAMPLE_MT940, 'export.sta');
    expect(rows).toHaveLength(1);
  });

  it('routes .csv to CSV parser', () => {
    const csv = `amount
5000
`;
    const rows = parseBankStatement(csv, 'stmt.csv');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.amount).toBe(500000);
  });

  it('throws on unsupported extension', () => {
    expect(() => parseBankStatement('x', 'file.pdf')).toThrow(/Unsupported bank statement format/);
  });
});

describe('matchStatementToRun', () => {
  const iban = 'PL61109010140000071219812874';

  it('matches exact IBAN + amount', () => {
    const tx: ParsedTransaction[] = [
      {
        amount: 10_000,
        currency: 'PLN',
        description: '',
        iban,
        date: new Date(),
      },
    ];
    const results = matchStatementToRun(tx, [{ id: 'item-1', amountMinor: 10_000, iban }]);
    expect(results[0]).toMatchObject({
      paymentRunItemId: 'item-1',
      confidence: 'exact',
      amountMatched: true,
      ibanMatched: true,
    });
  });

  it('marks unmatched when no item fits', () => {
    const tx: ParsedTransaction[] = [
      {
        amount: 1,
        currency: 'PLN',
        description: '',
        date: new Date(),
      },
    ];
    const results = matchStatementToRun(tx, []);
    expect(results[0]).toMatchObject({
      confidence: 'unmatched',
      paymentRunItemId: '',
    });
  });

  it('does not reuse the same payment run item twice', () => {
    const tx: ParsedTransaction[] = [
      {
        amount: 100,
        currency: 'PLN',
        description: '',
        iban,
        date: new Date(),
      },
      {
        amount: 100,
        currency: 'PLN',
        description: '',
        iban,
        date: new Date(),
      },
    ];
    const results = matchStatementToRun(tx, [{ id: 'only', amountMinor: 100, iban }]);
    expect(results[0]?.confidence).not.toBe('unmatched');
    expect(results[1]?.confidence).toBe('unmatched');
  });
});
