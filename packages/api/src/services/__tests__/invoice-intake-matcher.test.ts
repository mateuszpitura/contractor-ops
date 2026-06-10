// packages/api/src/services/__tests__/invoice-intake-matcher.test.ts
//
// Unit tests for `rankIntakeCandidates`.
//
// Uses a lightweight in-memory Prisma surface (bare `vi.fn()` stubs)
// conforming to the minimal reader shape the matcher requires. The real
// PrismaClient is not needed — the matcher is pure in the sense that it
// accepts any object implementing `{contractor, leitwegId}` reader handles.

import { describe, expect, it, vi } from 'vitest';

import {
  FUZZY_MAX_DISTANCE,
  levenshtein,
  normaliseContractorName,
  rankIntakeCandidates,
  SCORE_EXACT_NAME,
  SCORE_FUZZY_BASE,
  SCORE_LEITWEG_ID,
  SCORE_VAT_ID,
} from '../invoice-intake-matcher';

interface FakeContractor {
  id: string;
  legalName: string;
  displayName: string;
  vatId: string | null;
  organizationId: string;
}

interface FakeLeitwegId {
  id: string;
  organizationId: string;
  value: string;
  contractorId: string | null;
}

function makeDb(opts: { contractors?: FakeContractor[]; leitwegIds?: FakeLeitwegId[] }) {
  const contractors = opts.contractors ?? [];
  const leitwegIds = opts.leitwegIds ?? [];

  const contractor = {
    findFirst: vi.fn(
      async (args: {
        where: {
          organizationId: string;
          vatId?: { equals: string; mode?: string };
        };
      }) => {
        const { organizationId, vatId } = args.where;
        if (!vatId) return null;
        const needle = vatId.equals.toLowerCase();
        return (
          contractors.find(
            c =>
              c.organizationId === organizationId &&
              c.vatId != null &&
              c.vatId.toLowerCase() === needle,
          ) ?? null
        );
      },
    ),
    findMany: vi.fn(async (args: { where: { organizationId: string } }) => {
      return contractors.filter(c => c.organizationId === args.where.organizationId);
    }),
  };

  const leitwegId = {
    findMany: vi.fn(async (args: { where: { organizationId: string; value: string } }) => {
      const { organizationId, value } = args.where;
      return leitwegIds
        .filter(l => l.organizationId === organizationId && l.value === value)
        .map(l => ({
          contractorId: l.contractorId,
          contractor:
            l.contractorId == null
              ? null
              : (contractors.find(c => c.id === l.contractorId) ?? null),
        }));
    }),
  };

  return { contractor, leitwegId };
}

const ORG_A = 'org_A';

describe('rankIntakeCandidates', () => {
  it('VAT-ID + fuzzy-name on same contractor aggregates score and reasons', async () => {
    // "Alphz GmbH" vs extracted "Alpha GmbH" → normalised "alphz" vs "alpha"
    // → shared first-3 prefix "alp" → fuzzy gate passes → distance 1
    const db = makeDb({
      contractors: [
        {
          id: 'c1',
          legalName: 'Alphz GmbH',
          displayName: 'Alphz',
          vatId: 'DE111111111',
          organizationId: ORG_A,
        },
      ],
    });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierVatId: 'DE111111111',
      supplierName: 'Alpha GmbH',
    });
    expect(ranked).toHaveLength(1);
    const [first] = ranked;
    if (!first) throw new Error('expected at least one candidate');
    // 100 (VAT) + (50 - 1*5 = 45) fuzzy = 145
    expect(first.score).toBe(SCORE_VAT_ID + (SCORE_FUZZY_BASE - 1 * 5));
    const reasons = first.reasons.map(r => r.reason).sort();
    expect(reasons).toEqual(['FUZZY_NAME', 'VAT_ID']);
  });

  it('VAT-ID on contractor A + EXACT-NAME on contractor B → A ranks first', async () => {
    const db = makeDb({
      contractors: [
        {
          id: 'c_a',
          legalName: 'Acme GmbH',
          displayName: 'Acme',
          vatId: 'DE999999999',
          organizationId: ORG_A,
        },
        {
          id: 'c_b',
          legalName: 'Zebra GmbH',
          displayName: 'Zebra',
          vatId: null,
          organizationId: ORG_A,
        },
      ],
    });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierVatId: 'DE999999999',
      supplierName: 'Zebra GmbH', // matches c_b exactly
    });
    expect(ranked).toHaveLength(2);
    const [first, second] = ranked;
    if (!(first && second)) throw new Error('expected two candidates');
    expect(first.contractorId).toBe('c_a');
    expect(first.score).toBe(SCORE_VAT_ID);
    expect(second.contractorId).toBe('c_b');
    expect(second.score).toBe(SCORE_EXACT_NAME);
  });

  it('no VAT-ID and no Leitweg-ID → only name strategies run', async () => {
    const db = makeDb({
      contractors: [
        {
          id: 'c1',
          legalName: 'Beta GmbH',
          displayName: 'Beta',
          vatId: 'DE222222222',
          organizationId: ORG_A,
        },
      ],
    });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierVatId: null,
      supplierLeitwegId: null,
      supplierName: 'Beta',
    });
    expect(db.contractor.findFirst).not.toHaveBeenCalled();
    expect(db.leitwegId.findMany).not.toHaveBeenCalled();
    expect(ranked).toHaveLength(1);
    const [first] = ranked;
    if (!first) throw new Error('expected one candidate');
    expect(first.reasons[0]?.reason).toBe('EXACT_NAME');
  });

  it('fuzzy distance 3 matches; distance 4 excluded', async () => {
    // Extracted name normalises to "aaaa" (4 chars).
    //   "aaaxyz"   → shared prefix "aaa", Levenshtein("aaaxyz","aaaa") = 3 → kept (score 35)
    //   "aaaxyzw"  → shared prefix "aaa", Levenshtein("aaaxyzw","aaaa") = 4 → excluded
    const db = makeDb({
      contractors: [
        {
          id: 'c_keep',
          legalName: 'aaaxyz',
          displayName: 'aaaxyz',
          vatId: null,
          organizationId: ORG_A,
        },
        {
          id: 'c_drop',
          legalName: 'aaaxyzw',
          displayName: 'aaaxyzw',
          vatId: null,
          organizationId: ORG_A,
        },
      ],
    });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierName: 'aaaa',
    });
    expect(ranked).toHaveLength(1);
    const [first] = ranked;
    if (!first) throw new Error('expected one candidate');
    expect(first.contractorId).toBe('c_keep');
    // score = 50 - 3*5 = 35
    expect(first.score).toBe(SCORE_FUZZY_BASE - FUZZY_MAX_DISTANCE * 5);
    expect(first.reasons[0]).toEqual({ reason: 'FUZZY_NAME', detail: 'distance 3' });
  });

  it('first-3-char prefix gate skips "Zebra GmbH" when extracted is "Alpha GmbH"', async () => {
    const db = makeDb({
      contractors: [
        {
          id: 'c_z',
          legalName: 'Zebra GmbH',
          displayName: 'Zebra',
          vatId: null,
          organizationId: ORG_A,
        },
      ],
    });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierName: 'Alpha GmbH',
    });
    expect(ranked).toHaveLength(0);
  });

  it('German suffix normalisation collides "Alpha GmbH" and "Alpha AG" on EXACT_NAME', async () => {
    const db = makeDb({
      contractors: [
        {
          id: 'c_gmbh',
          legalName: 'Alpha GmbH',
          displayName: 'Alpha GmbH',
          vatId: null,
          organizationId: ORG_A,
        },
        {
          id: 'c_ag',
          legalName: 'Alpha AG',
          displayName: 'Alpha AG',
          vatId: null,
          organizationId: ORG_A,
        },
      ],
    });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierName: 'Alpha GmbH',
    });
    expect(ranked).toHaveLength(2);
    for (const candidate of ranked) {
      expect(candidate.score).toBe(SCORE_EXACT_NAME);
      expect(candidate.reasons[0]?.reason).toBe('EXACT_NAME');
    }
  });

  it('caps returned list at 5 candidates', async () => {
    const contractors: FakeContractor[] = Array.from({ length: 8 }, (_, idx) => ({
      id: `c_${idx}`,
      legalName: `Alpha${idx}`, // all share prefix "alp" and normalise different tails
      displayName: `Alpha${idx}`,
      vatId: null,
      organizationId: ORG_A,
    }));
    const db = makeDb({ contractors });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierName: 'Alpha0',
    });
    expect(ranked.length).toBe(5);
  });

  it('Leitweg-ID match ranks above fuzzy name match', async () => {
    const db = makeDb({
      contractors: [
        {
          id: 'c_leitweg',
          legalName: 'Gamma GmbH',
          displayName: 'Gamma',
          vatId: null,
          organizationId: ORG_A,
        },
        {
          id: 'c_name',
          legalName: 'Deltb GmbH',
          displayName: 'Deltb',
          vatId: null,
          organizationId: ORG_A,
        },
      ],
      leitwegIds: [
        {
          id: 'lw1',
          organizationId: ORG_A,
          value: '04011000-1234512345-06',
          contractorId: 'c_leitweg',
        },
      ],
    });
    const ranked = await rankIntakeCandidates(db, ORG_A, {
      supplierName: 'Delta GmbH', // fuzzy dist 1 to "deltb"
      supplierLeitwegId: '04011000-1234512345-06',
    });
    expect(ranked).toHaveLength(2);
    const [first] = ranked;
    if (!first) throw new Error('expected two candidates');
    expect(first.contractorId).toBe('c_leitweg');
    expect(first.score).toBe(SCORE_LEITWEG_ID);
    expect(first.reasons[0]?.reason).toBe('LEITWEG_ID');
  });
});

describe('normaliseContractorName', () => {
  it('lowercases and trims', () => {
    expect(normaliseContractorName('  HELLO World ')).toBe('hello world');
  });

  it('strips German corporate forms', () => {
    expect(normaliseContractorName('Alpha GmbH')).toBe('alpha');
    expect(normaliseContractorName('Beta AG')).toBe('beta');
    expect(normaliseContractorName('Gamma KG')).toBe('gamma');
    expect(normaliseContractorName('Delta OHG')).toBe('delta');
  });

  it('strips UK/US corporate forms', () => {
    expect(normaliseContractorName('Alpha Ltd')).toBe('alpha');
    expect(normaliseContractorName('Beta Ltd.')).toBe('beta');
    expect(normaliseContractorName('Gamma Limited')).toBe('gamma');
    expect(normaliseContractorName('Delta Inc')).toBe('delta');
  });

  it('collapses repeated whitespace', () => {
    expect(normaliseContractorName('alpha     beta')).toBe('alpha beta');
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length for an empty opposite', () => {
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', 'abcd')).toBe(4);
  });

  it('counts single-char substitutions', () => {
    expect(levenshtein('kitten', 'sitten')).toBe(1);
  });

  it('counts composite edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});
