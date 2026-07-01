import { describe, expect, it } from 'vitest';
import { mapReturnCodeToStatus, parseNachaReturnFile } from '../ach-return.service';

// The DB-apply idempotency contract (applyAchReturns flips a live PaymentRunItem
// to FAILED and a re-delivered return file is a no-op) is authored with its DB
// harness alongside the ingestion implementation. This file pins the pure
// parse + map contract only. Every case fails today against the throwing stub.

// Right-justify / left-justify helpers so each fixed-width NACHA field lands at
// the exact column offset the parser reads (mirroring the generator's layout).
const padRight = (value: string, len: number): string => value.padEnd(len, ' ').slice(0, len);
const padLeftZero = (value: string, len: number): string => value.padStart(len, '0').slice(-len);

// A minimal NACHA return file: one entry-detail (type 6) record for the returned
// credit, followed by its addenda (type 7, addenda type code 99) carrying the
// return reason. Field widths match the entry-detail / addenda-99 column layout.
const RETURN_FILE = [
  [
    '6',
    '21', // transaction code — return of a checking credit
    padLeftZero('12345678', 8), // RDFI routing (first 8 digits)
    '9', // routing check digit
    padRight('000987654321', 17), // DFI account number
    padLeftZero('5000000', 10), // amount in cents ($50,000.00)
    padRight('INV-US-001', 15), // individual id — the original invoice reference
    padRight('US PAYEE LLC', 22), // receiver name
    padRight('', 2), // discretionary data
    '1', // addenda record indicator
    padRight('021000020000001', 15), // trace number
  ].join(''),
  [
    '7',
    '99', // addenda type code — return
    'R01', // return reason code
    padRight('021000020000001', 15), // original entry trace
    padRight('', 6), // date of death (unused)
    padLeftZero('12345678', 8), // original receiving DFI id
    padRight('INSUFFICIENT FUNDS', 44), // addenda information
    padRight('021000020000001', 15), // trace number
  ].join(''),
].join('\r\n');

describe('mapReturnCodeToStatus', () => {
  it('maps R01 (insufficient funds) to a FAILED disposition', () => {
    const mapping = mapReturnCodeToStatus('R01');
    expect(mapping.disposition).toBe('FAILED');
    expect(mapping.reason.toLowerCase()).toContain('insufficient');
  });

  it('maps R02 (account closed) to a FAILED disposition', () => {
    const mapping = mapReturnCodeToStatus('R02');
    expect(mapping.disposition).toBe('FAILED');
    expect(mapping.reason.toLowerCase()).toContain('closed');
  });

  it('maps R03 (no account / unable to locate) to a FAILED disposition', () => {
    const mapping = mapReturnCodeToStatus('R03');
    expect(mapping.disposition).toBe('FAILED');
    expect(mapping.reason.toLowerCase()).toMatch(/no account|unable to locate/);
  });

  it('maps a NOC/COR correction code to an ADVISORY disposition (never a failure)', () => {
    expect(mapReturnCodeToStatus('C01').disposition).toBe('ADVISORY');
    expect(mapReturnCodeToStatus('NOC').disposition).toBe('ADVISORY');
  });
});

describe('parseNachaReturnFile', () => {
  it('parses a returned entry + its addenda-99 R-code into one AchReturnEntry', () => {
    const entries = parseNachaReturnFile(RETURN_FILE);

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.traceNumber).toBe('021000020000001');
    expect(entry?.individualId).toBe('INV-US-001');
    expect(entry?.amountMinor).toBe(50_000_00);
    expect(entry?.returnCode).toBe('R01');
    expect(entry?.addendaInfo).toContain('INSUFFICIENT FUNDS');
  });
});
