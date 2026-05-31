import { describe, expect, it, vi } from 'vitest';
import { insertProvenance, provenanceLookup } from '../provenance';

type DbArg = Parameters<typeof provenanceLookup>[0];

// biome-ignore lint/suspicious/noExplicitAny: test-only Prisma mock overrides
const makeDb = (overrides: Partial<{ findFirst: any; updateMany: any; create: any }> = {}) =>
  ({
    idpChangeProvenance: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'p-1' }),
      ...overrides,
    },
    // biome-ignore lint/suspicious/noExplicitAny: cast a partial mock to the Prisma client param type
  }) as any as DbArg;

const baseInput = {
  organizationId: 'org-1',
  provider: 'GOOGLE_WORKSPACE',
  externalUserId: 'u@example.com',
  actionKind: 'SUSPEND',
} as const;

describe('provenanceLookup (Phase 76 D-10)', () => {
  it('returns null when no row matches', async () => {
    const db = makeDb({ findFirst: vi.fn().mockResolvedValue(null) });
    expect(await provenanceLookup(db, baseInput)).toBeNull();
  });

  it('returns { id } and atomically sets matchedAt when a row matches', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = makeDb({ findFirst: vi.fn().mockResolvedValue({ id: 'p-1' }), updateMany });
    expect(await provenanceLookup(db, baseInput)).toEqual({ id: 'p-1' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p-1', matchedAt: null },
      data: { matchedAt: expect.any(Date) },
    });
  });

  it('returns null on lost race (concurrent webhook claimed first → updateMany count=0)', async () => {
    const db = makeDb({
      findFirst: vi.fn().mockResolvedValue({ id: 'p-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    });
    expect(await provenanceLookup(db, baseInput)).toBeNull();
  });

  it('respects 1-hour window — query has initiatedAt: { gte: cutoff }', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = makeDb({ findFirst });
    await provenanceLookup(db, baseInput);
    const call = findFirst.mock.calls[0][0];
    expect(call.where.initiatedAt).toEqual({ gte: expect.any(Date) });
    const cutoff = call.where.initiatedAt.gte as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(60 * 60 * 1000 - 5000);
    expect(Date.now() - cutoff.getTime()).toBeLessThan(60 * 60 * 1000 + 5000);
  });

  it('filters out already-matched rows (matchedAt: null)', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = makeDb({ findFirst });
    await provenanceLookup(db, baseInput);
    expect(findFirst.mock.calls[0][0].where.matchedAt).toBeNull();
  });
});

describe('insertProvenance (Phase 76 D-09)', () => {
  it('inserts a row with the input fields and returns id', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'p-new' });
    const db = makeDb({ create });
    const result = await insertProvenance(db, { ...baseInput, deprovisioningStepId: 's-1' });
    expect(result).toEqual({ id: 'p-new' });
    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        provider: 'GOOGLE_WORKSPACE',
        externalUserId: 'u@example.com',
        actionKind: 'SUSPEND',
        deprovisioningStepId: 's-1',
      },
      select: { id: true },
    });
  });

  it('REVOKE_SESSION action kind passes through unchanged', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'p-2' });
    const db = makeDb({ create });
    await insertProvenance(db, {
      ...baseInput,
      actionKind: 'REVOKE_SESSION',
      deprovisioningStepId: 's-1',
    });
    expect(create.mock.calls[0][0].data.actionKind).toBe('REVOKE_SESSION');
  });
});
