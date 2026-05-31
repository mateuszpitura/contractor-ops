import type { PrismaClient } from '@contractor-ops/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findExistingSucceededRun } from '../dedup.js';

// In-memory mock of the single Prisma method dedup uses.
function makeDb(findFirstImpl: (args: { where: Record<string, unknown> }) => unknown) {
  const findFirst = vi.fn(findFirstImpl);
  return {
    db: { contractHealthCheckRun: { findFirst } } as unknown as PrismaClient,
    findFirst,
  };
}

describe('findExistingSucceededRun (Phase 75 D-03)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing row when a SUCCEEDED match exists', async () => {
    const { db, findFirst } = makeDb(() => ({ id: 'run_1' }));
    const result = await findExistingSucceededRun(db, {
      contractId: 'ct_1',
      contentHash: 'h1',
      modelVer: 'm1',
    });
    expect(result?.id).toBe('run_1');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'SUCCEEDED' }) }),
    );
  });

  it('returns null when no SUCCEEDED match exists (FAILED row exists)', async () => {
    const { db } = makeDb(() => null);
    const result = await findExistingSucceededRun(db, {
      contractId: 'ct_1',
      contentHash: 'h1',
      modelVer: 'm1',
    });
    expect(result).toBeNull();
  });

  it('only matches when the where clause includes status SUCCEEDED', async () => {
    // A FAILED row exists, but the query filters status=SUCCEEDED -> null.
    const { db } = makeDb(args => {
      const where = args.where as { status?: string };
      return where.status === 'SUCCEEDED' ? null : { id: 'failed_run' };
    });
    const result = await findExistingSucceededRun(db, {
      contractId: 'ct_1',
      contentHash: 'h1',
      modelVer: 'm1',
    });
    expect(result).toBeNull();
  });

  it('passes the full dedup key (contractId, contentHash, modelVer) to the query', async () => {
    const { db, findFirst } = makeDb(() => null);
    await findExistingSucceededRun(db, {
      contractId: 'ct_9',
      contentHash: 'NEW_HASH',
      modelVer: 'NEW_MODEL',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contractId: 'ct_9',
          contentHash: 'NEW_HASH',
          modelVer: 'NEW_MODEL',
          status: 'SUCCEEDED',
        }),
      }),
    );
  });

  it('different modelVer with same hash is a distinct dedup key (model-bump pathway)', async () => {
    const { db, findFirst } = makeDb(() => null);
    await findExistingSucceededRun(db, { contractId: 'ct_1', contentHash: 'h1', modelVer: 'm2' });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ modelVer: 'm2' }) }),
    );
  });

  it('different contentHash with same modelVer is a distinct dedup key (re-uploaded PDF)', async () => {
    const { db, findFirst } = makeDb(() => null);
    await findExistingSucceededRun(db, { contractId: 'ct_1', contentHash: 'h2', modelVer: 'm1' });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contentHash: 'h2' }) }),
    );
  });
});
