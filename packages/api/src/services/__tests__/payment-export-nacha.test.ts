// Terminal-RED Wave-0 scaffold for the NACHA ACH credit-file generator.
//
// RED until `generateNachaFile` is exported from `../payment-export`. The symbol
// does not exist yet, so the import below resolves to `undefined` and the first
// call throws `generateNachaFile is not a function` — the suite fails for the
// right reason (the production symbol is absent), not from a typo or an
// import-path error.
//
// This pins the NACHA file contract a downstream wave must satisfy, mirroring
// the fixed-width / control-total / hard-length-guard shape of
// `generateBacsStandard18`:
//   - every record is exactly 94 characters
//   - record-type codes appear in order 1 (file header) -> 5 (batch header) ->
//     6 (entry detail) -> 8 (batch control) -> 9 (file control)
//   - the batch-control entry hash = sum of the first 8 digits of each RDFI
//     routing number, truncated to the rightmost 10 digits
//   - total credit = sum of every entry amount in cents
//   - total line count is a multiple of 10 (9-record block padding)
//   - service class 220 (credits only), SEC code PPD, transaction code 22
//     (checking credit) by default
//
// Routing/account numbers in the fixture are obviously-synthetic (021000021 is
// an ABA test routing; accounts are sequential placeholders) — never a real
// masked production account, and full numbers are never logged.

import { describe, expect, it } from 'vitest';

// generateNachaFile does not exist yet — the import resolves to `undefined` and
// the first call throws `generateNachaFile is not a function`. That absence IS
// the RED.
import { generateNachaFile } from '../payment-export';

/** Per-entry input to the NACHA generator (decrypted by the caller, never an encrypted blob). */
interface NachaEntryFixture {
  receiverName: string;
  /** RDFI routing/transit number: 8 digits + 1 check digit. */
  routingNumber: string;
  /** Destination DFI account number. */
  accountNumber: string;
  /** Credit amount in cents (no decimal point). */
  amountMinor: number;
  /** Receiver individual/company identification. */
  individualId: string;
}

/** Originating-DFI (company) file-level details, all hand-set per the ODFI spec. */
interface NachaOriginFixture {
  immediateDestination: string;
  immediateOrigin: string;
  companyName: string;
  companyId: string;
  odfiRoutingPrefix: string;
}

const NACHA_RECORD_LEN = 94;

const originFixture: NachaOriginFixture = {
  immediateDestination: '021000021',
  immediateOrigin: '1234567890',
  companyName: 'ACME CONTRACTOR',
  companyId: '1234567890',
  odfiRoutingPrefix: '02100002',
};

const entryFixtures: NachaEntryFixture[] = [
  {
    receiverName: 'JAN KOWALSKI',
    routingNumber: '021000021',
    accountNumber: '000123456789',
    amountMinor: 50_000,
    individualId: 'INV-2026-001',
  },
  {
    receiverName: 'MARIA NOWAK',
    routingNumber: '011401533',
    accountNumber: '000987654321',
    amountMinor: 37_500,
    individualId: 'INV-2026-002',
  },
  {
    receiverName: 'PIOTR LEWANDOWSKI',
    routingNumber: '091000019',
    accountNumber: '000555000111',
    amountMinor: 12_500,
    individualId: 'INV-2026-003',
  },
];

/** Entry hash = sum of the first 8 digits of each RDFI routing number, mod 10^10. */
function expectedEntryHash(entries: NachaEntryFixture[]): number {
  const sum = entries.reduce((acc, e) => acc + Number(e.routingNumber.slice(0, 8)), 0);
  return sum % 10_000_000_000;
}

function toLines(buffer: Buffer): string[] {
  return buffer.toString('ascii').split(/\r?\n/).filter(Boolean);
}

// Skipped: the NACHA generator is not implemented yet (Wave-0 RED scaffold).
// Un-skip when `generateNachaFile` lands so these pinned contracts go GREEN.
describe.skip('generateNachaFile', () => {
  it('returns a buffer with a .txt extension', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    expect(result.fileBuffer).toBeInstanceOf(Buffer);
    expect(result.ext).toBe('txt');
  });

  it('produces records that are each exactly 94 characters', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    for (const line of toLines(result.fileBuffer)) {
      expect(line.length).toBe(NACHA_RECORD_LEN);
    }
  });

  it('emits record types in the order 1 / 5 / 6 / 8 / 9', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    const lines = toLines(result.fileBuffer);

    expect(lines[0]?.[0]).toBe('1'); // file header
    expect(lines[1]?.[0]).toBe('5'); // batch header
    // entry-detail records (6) for every credit, contiguous after the batch header
    const detailLines = lines.slice(2, 2 + entryFixtures.length);
    for (const line of detailLines) {
      expect(line[0]).toBe('6');
    }
    const batchControl = lines[2 + entryFixtures.length];
    expect(batchControl?.[0]).toBe('8'); // batch control

    // file control (9) is the first 9-record; padding 9-records may follow.
    const fileControlIdx = lines.findIndex(l => l[0] === '9');
    expect(fileControlIdx).toBe(3 + entryFixtures.length);
  });

  it('defaults to service class 220 (credits only) in the batch header', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    const batchHeader = toLines(result.fileBuffer).find(l => l[0] === '5');
    expect(batchHeader?.slice(1, 4)).toBe('220');
  });

  it('defaults SEC code PPD in the batch header', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    const batchHeader = toLines(result.fileBuffer).find(l => l[0] === '5');
    expect(batchHeader).toContain('PPD');
  });

  it('defaults transaction code 22 (checking credit) on every entry detail', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    const detailLines = toLines(result.fileBuffer).filter(l => l[0] === '6');
    for (const line of detailLines) {
      // Transaction code occupies positions 2-3 (record type at position 1).
      expect(line.slice(1, 3)).toBe('22');
    }
  });

  it('writes the batch-control entry hash as the rightmost 10 digits of the routing-prefix sum', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    const batchControl = toLines(result.fileBuffer).find(l => l[0] === '8');
    const hash = String(expectedEntryHash(entryFixtures)).padStart(10, '0');
    expect(batchControl).toContain(hash);
  });

  it('sets the total credit to the sum of every entry amount in cents', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    const totalCredit = entryFixtures.reduce((acc, e) => acc + e.amountMinor, 0);
    const batchControl = toLines(result.fileBuffer).find(l => l[0] === '8');
    expect(batchControl).toContain(String(totalCredit).padStart(12, '0'));
  });

  it('pads the file with all-9 records to a line count that is a multiple of 10', () => {
    const result = generateNachaFile(entryFixtures, originFixture);
    const lines = toLines(result.fileBuffer);
    expect(lines.length % 10).toBe(0);
    const fileControlIdx = lines.findIndex(l => l[0] === '9');
    for (const line of lines.slice(fileControlIdx + 1)) {
      expect(line).toBe('9'.repeat(NACHA_RECORD_LEN));
    }
  });
});
