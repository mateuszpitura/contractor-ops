// packages/api/src/services/__tests__/peppol-capability.test.ts
//
// Phase 61 · Plan 61-05 Task 2 — capability cache + pre-flight helper tests.
//
// Coverage:
//   1. Cache miss → Storecove adapter called once → cache row upserted.
//   2. Cache hit within TTL → adapter NOT called; fromCache = true.
//   3. Cache expired → adapter called; new expiresAt written.
//   4. forceRefresh: true → adapter called even on cache hit.
//   5. supportsXRechnungCii happy + negative path.
//   6. Cross-tenant isolation — orgA cache never served to orgB.
//   7. assertSenderParticipantActive throws/succeeds.
//   8. assertReceiverAcceptsXRechnung throws PARTICIPANT_NOT_REACHABLE on empty
//      documentTypes.
//
// Uses an in-memory fake Prisma + a lightweight ASPAdapter mock.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID } from '@contractor-ops/einvoice';

// ---------------------------------------------------------------------------
// Import under test (module created alongside this file).
// ---------------------------------------------------------------------------
import {
  assertReceiverAcceptsXRechnung,
  assertSenderParticipantActive,
  CAPABILITY_CACHE_TTL_MS,
  getCapabilitiesWithCache,
  supportsXRechnungCii,
} from '../peppol-capability.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface CacheRow {
  id: string;
  organizationId: string;
  schemeId: string;
  value: string;
  documentTypes: string[];
  cachedAt: Date;
  expiresAt: Date;
}

interface ParticipantRow {
  id: string;
  organizationId: string;
  participantId: string;
  status: string;
}

function makeCacheTable() {
  const rows: CacheRow[] = [];
  return {
    rows,
    findUnique: vi.fn(async (args: { where: { organizationId_schemeId_value: { organizationId: string; schemeId: string; value: string } } }) => {
      const key = args.where.organizationId_schemeId_value;
      return (
        rows.find(
          (r) =>
            r.organizationId === key.organizationId &&
            r.schemeId === key.schemeId &&
            r.value === key.value,
        ) ?? null
      );
    }),
    upsert: vi.fn(
      async (args: {
        where: { organizationId_schemeId_value: { organizationId: string; schemeId: string; value: string } };
        create: Omit<CacheRow, 'id' | 'cachedAt'> & { cachedAt?: Date };
        update: Partial<CacheRow>;
      }) => {
        const key = args.where.organizationId_schemeId_value;
        const existing = rows.find(
          (r) =>
            r.organizationId === key.organizationId &&
            r.schemeId === key.schemeId &&
            r.value === key.value,
        );
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        const created: CacheRow = {
          id: `cache-${rows.length + 1}`,
          organizationId: args.create.organizationId,
          schemeId: args.create.schemeId,
          value: args.create.value,
          documentTypes: args.create.documentTypes as string[],
          cachedAt: args.create.cachedAt ?? new Date(),
          expiresAt: args.create.expiresAt,
        };
        rows.push(created);
        return created;
      },
    ),
  };
}

function makeParticipantTable() {
  const rows: ParticipantRow[] = [];
  return {
    rows,
    findFirst: vi.fn(
      async (args: {
        where: { organizationId: string; status?: string | { in: string[] } };
      }) => {
        return (
          rows.find((r) => {
            if (r.organizationId !== args.where.organizationId) return false;
            const statusCond = args.where.status;
            if (!statusCond) return true;
            if (typeof statusCond === 'string') return r.status === statusCond;
            if (typeof statusCond === 'object' && 'in' in statusCond) {
              return statusCond.in.includes(r.status);
            }
            return false;
          }) ?? null
        );
      },
    ),
    update: vi.fn(
      async (args: { where: { id: string }; data: Partial<ParticipantRow> }) => {
        const row = rows.find((r) => r.id === args.where.id);
        if (!row) return null;
        Object.assign(row, args.data);
        return row;
      },
    ),
  };
}

function makeDb() {
  const peppolCapabilityCache = makeCacheTable();
  const peppolParticipant = makeParticipantTable();
  return {
    peppolCapabilityCache,
    peppolParticipant,
  };
}

function makeAdapter(documentTypes: string[]) {
  return {
    lookupParticipantCapabilities: vi.fn(async (params: { schemeId: string; value: string }) => ({
      schemeId: params.schemeId,
      value: params.value,
      documentTypes,
      fetchedAt: new Date(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const ORG_A = 'org_A';
const ORG_B = 'org_B';

describe('getCapabilitiesWithCache', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('cache miss → adapter called once, row upserted, fromCache=false', async () => {
    const db = makeDb();
    const adapter = makeAdapter([STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID]);

    const result = await getCapabilitiesWithCache(
      db as never,
      adapter as never,
      ORG_A,
      '0060',
      'GB123',
    );

    expect(adapter.lookupParticipantCapabilities).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.documentTypes).toContain(STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID);
    expect(db.peppolCapabilityCache.rows).toHaveLength(1);
    expect(db.peppolCapabilityCache.rows[0]?.organizationId).toBe(ORG_A);
  });

  it('cache hit within TTL → adapter NOT called, fromCache=true', async () => {
    const db = makeDb();
    const adapter = makeAdapter([STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID]);
    const now = new Date();
    db.peppolCapabilityCache.rows.push({
      id: 'c1',
      organizationId: ORG_A,
      schemeId: '0060',
      value: 'GB123',
      documentTypes: [STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID],
      cachedAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1h in future
    });

    const result = await getCapabilitiesWithCache(
      db as never,
      adapter as never,
      ORG_A,
      '0060',
      'GB123',
    );

    expect(adapter.lookupParticipantCapabilities).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.documentTypes).toEqual([STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID]);
  });

  it('expired cache → adapter called, expiresAt bumped, fromCache=false', async () => {
    const db = makeDb();
    const adapter = makeAdapter([STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID]);
    const expiredRow: CacheRow = {
      id: 'c1',
      organizationId: ORG_A,
      schemeId: '0060',
      value: 'GB123',
      documentTypes: ['stale-doctype'],
      cachedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 1000), // 1s expired
    };
    db.peppolCapabilityCache.rows.push(expiredRow);

    const result = await getCapabilitiesWithCache(
      db as never,
      adapter as never,
      ORG_A,
      '0060',
      'GB123',
    );

    expect(adapter.lookupParticipantCapabilities).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.documentTypes).toContain(STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID);
    // Same single row, now with a future expiresAt.
    expect(db.peppolCapabilityCache.rows).toHaveLength(1);
    expect(db.peppolCapabilityCache.rows[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('forceRefresh: true → adapter called even when cache is fresh', async () => {
    const db = makeDb();
    const adapter = makeAdapter(['new-doctype']);
    db.peppolCapabilityCache.rows.push({
      id: 'c1',
      organizationId: ORG_A,
      schemeId: '0060',
      value: 'GB123',
      documentTypes: ['old-doctype'],
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const result = await getCapabilitiesWithCache(
      db as never,
      adapter as never,
      ORG_A,
      '0060',
      'GB123',
      { forceRefresh: true },
    );

    expect(adapter.lookupParticipantCapabilities).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.documentTypes).toEqual(['new-doctype']);
  });

  it('multi-tenant isolation — orgA cache not served to orgB', async () => {
    const db = makeDb();
    const adapter = makeAdapter(['fresh-for-orgB']);
    // orgA has a cached row for (0060, GB123)
    db.peppolCapabilityCache.rows.push({
      id: 'c-a',
      organizationId: ORG_A,
      schemeId: '0060',
      value: 'GB123',
      documentTypes: ['orgA-cached'],
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const result = await getCapabilitiesWithCache(
      db as never,
      adapter as never,
      ORG_B,
      '0060',
      'GB123',
    );

    expect(adapter.lookupParticipantCapabilities).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.documentTypes).toEqual(['fresh-for-orgB']);
    // Two rows now: one per org.
    expect(db.peppolCapabilityCache.rows).toHaveLength(2);
  });
});

describe('supportsXRechnungCii', () => {
  it('returns true when the doc type is present', () => {
    expect(
      supportsXRechnungCii(['other', STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID]),
    ).toBe(true);
  });

  it('returns false for empty / missing list', () => {
    expect(supportsXRechnungCii([])).toBe(false);
    expect(supportsXRechnungCii(['urn:peppol:bis:3'])).toBe(false);
  });
});

describe('assertSenderParticipantActive', () => {
  it('throws PEPPOL_PARTICIPANT_NOT_ACTIVE when no ACTIVE participant exists', async () => {
    const db = makeDb();
    await expect(assertSenderParticipantActive(db as never, ORG_A)).rejects.toThrow(
      'PEPPOL_PARTICIPANT_NOT_ACTIVE',
    );
  });

  it('resolves quietly when participant status is ACTIVE', async () => {
    const db = makeDb();
    db.peppolParticipant.rows.push({
      id: 'p1',
      organizationId: ORG_A,
      participantId: '0192:123456789012345',
      status: 'ACTIVE',
    });
    await expect(assertSenderParticipantActive(db as never, ORG_A)).resolves.toBeUndefined();
  });

  it('throws when participant exists but status is not ACTIVE', async () => {
    const db = makeDb();
    db.peppolParticipant.rows.push({
      id: 'p1',
      organizationId: ORG_A,
      participantId: '0192:123456789012345',
      status: 'PENDING',
    });
    await expect(assertSenderParticipantActive(db as never, ORG_A)).rejects.toThrow(
      'PEPPOL_PARTICIPANT_NOT_ACTIVE',
    );
  });
});

describe('assertReceiverAcceptsXRechnung', () => {
  it('throws PARTICIPANT_NOT_REACHABLE when capability lookup returns empty documentTypes', async () => {
    const db = makeDb();
    const adapter = makeAdapter([]);

    await expect(
      assertReceiverAcceptsXRechnung(db as never, adapter as never, ORG_A, '0060', 'GB-unknown'),
    ).rejects.toThrow('PARTICIPANT_NOT_REACHABLE');
  });

  it('resolves quietly when capability list includes the XRechnung-CII doc type', async () => {
    const db = makeDb();
    const adapter = makeAdapter([STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID]);

    await expect(
      assertReceiverAcceptsXRechnung(db as never, adapter as never, ORG_A, '0060', 'GB123'),
    ).resolves.toBeUndefined();
  });

  it('throws PARTICIPANT_NOT_REACHABLE when recipient advertises only UBL (no CII)', async () => {
    const db = makeDb();
    const adapter = makeAdapter(['urn:peppol:bis:3-ubl-only']);

    await expect(
      assertReceiverAcceptsXRechnung(db as never, adapter as never, ORG_A, '0060', 'GB-ubl-only'),
    ).rejects.toThrow('PARTICIPANT_NOT_REACHABLE');
  });
});

describe('CAPABILITY_CACHE_TTL_MS', () => {
  it('matches the 6h window required by CONTEXT D-11', () => {
    expect(CAPABILITY_CACHE_TTL_MS).toBe(6 * 60 * 60 * 1000);
    expect(CAPABILITY_CACHE_TTL_MS).toBe(21_600_000);
  });
});
