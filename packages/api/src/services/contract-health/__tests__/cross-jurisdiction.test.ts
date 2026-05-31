import type { PrismaClient } from '@contractor-ops/db';
import { describe, expect, it } from 'vitest';
import {
  analyzeCrossJurisdiction,
  mapIsoToJurisdiction,
  resolveContractJurisdiction,
} from '../cross-jurisdiction.js';

function makeDb(contract: unknown): PrismaClient {
  return {
    contract: { findUnique: async () => contract },
  } as unknown as PrismaClient;
}

describe('analyzeCrossJurisdiction (Phase 75 D-15)', () => {
  it('DE contract citing only UK phrases → mismatch (caller raises MANUAL_REVIEW_REQUIRED)', () => {
    const r = analyzeCrossJurisdiction('DE', ['UK']);
    expect(r.mismatch).toBe(true);
    expect(r.expectedJurisdiction).toBe('DE');
    expect(r.foundJurisdictions).toEqual(['UK']);
  });

  it('DE contract citing both UK and DE phrases → no mismatch (DE is present)', () => {
    const r = analyzeCrossJurisdiction('DE', ['UK', 'DE']);
    expect(r.mismatch).toBe(false);
  });

  it('UK contract citing only UK phrases → no mismatch', () => {
    const r = analyzeCrossJurisdiction('UK', ['UK']);
    expect(r.mismatch).toBe(false);
    expect(r.foundJurisdictions).toEqual(['UK']);
  });

  it('UK contract citing only DE phrases → mismatch with foundJurisdiction DE', () => {
    const r = analyzeCrossJurisdiction('UK', ['DE']);
    expect(r.mismatch).toBe(true);
    expect(r.foundJurisdictions).toEqual(['DE']);
  });

  it('null expected jurisdiction → mismatch (every cited clause is foreign by definition)', () => {
    const r = analyzeCrossJurisdiction(null, ['UK']);
    expect(r.mismatch).toBe(true);
    expect(r.expectedJurisdiction).toBeNull();
  });

  it('no cited clauses → no mismatch (nothing to disagree with)', () => {
    const r = analyzeCrossJurisdiction('DE', []);
    expect(r.mismatch).toBe(false);
  });
});

describe('mapIsoToJurisdiction (alpha-2 + alpha-3)', () => {
  it('maps alpha-3 contract codes', () => {
    expect(mapIsoToJurisdiction('GBR')).toBe('UK');
    expect(mapIsoToJurisdiction('DEU')).toBe('DE');
  });
  it('maps alpha-2 country codes', () => {
    expect(mapIsoToJurisdiction('GB')).toBe('UK');
    expect(mapIsoToJurisdiction('DE')).toBe('DE');
    expect(mapIsoToJurisdiction('AE')).toBe('UAE');
  });
  it('returns null for unknown codes', () => {
    expect(mapIsoToJurisdiction('FR')).toBeNull();
  });
});

describe('resolveContractJurisdiction fallback chain (RESEARCH §3)', () => {
  it('uses Contract.jurisdiction when present', async () => {
    const db = makeDb({
      jurisdiction: 'DEU',
      contractor: { countryCode: 'GB' },
      organization: { countryCode: 'GB' },
    });
    expect(await resolveContractJurisdiction(db, 'ct_1')).toBe('DE');
  });

  it('falls back to Contractor.countryCode when Contract.jurisdiction is null', async () => {
    const db = makeDb({
      jurisdiction: null,
      contractor: { countryCode: 'PL' },
      organization: { countryCode: 'GB' },
    });
    expect(await resolveContractJurisdiction(db, 'ct_1')).toBe('PL');
  });

  it('falls back to Organization.countryCode when both above are null', async () => {
    const db = makeDb({
      jurisdiction: null,
      contractor: { countryCode: null },
      organization: { countryCode: 'GB' },
    });
    expect(await resolveContractJurisdiction(db, 'ct_1')).toBe('UK');
  });

  it('returns null when no jurisdiction can be resolved', async () => {
    const db = makeDb({
      jurisdiction: null,
      contractor: { countryCode: null },
      organization: { countryCode: null },
    });
    expect(await resolveContractJurisdiction(db, 'ct_1')).toBeNull();
  });

  it('returns null when the contract does not exist', async () => {
    const db = makeDb(null);
    expect(await resolveContractJurisdiction(db, 'missing')).toBeNull();
  });
});
