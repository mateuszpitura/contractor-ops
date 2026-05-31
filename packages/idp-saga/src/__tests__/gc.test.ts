import { describe, expect, it, vi } from 'vitest';
import { gcExpiredProvenance } from '../gc';

const makeDb = (deleteCount = 0) =>
  ({
    idpChangeProvenance: {
      deleteMany: vi.fn().mockResolvedValue({ count: deleteCount }),
    },
    // biome-ignore lint/suspicious/noExplicitAny: cast a partial mock to the Prisma client param type
  }) as any as Parameters<typeof gcExpiredProvenance>[0];

describe('gcExpiredProvenance (Phase 76 D-12)', () => {
  it('deletes rows where initiatedAt < now - 90d', async () => {
    const db = makeDb(7);
    const now = new Date('2026-04-26T00:00:00Z');
    const result = await gcExpiredProvenance(db, now);
    expect(result.deleted).toBe(7);
    // biome-ignore lint/suspicious/noExplicitAny: reading the mock call args
    const call = (db.idpChangeProvenance.deleteMany as any).mock.calls[0][0];
    const cutoff = call.where.initiatedAt.lt as Date;
    expect(cutoff.toISOString()).toBe('2026-01-26T00:00:00.000Z'); // exactly 90 days back
  });

  it('returns deleted: 0 when no rows expired (idempotent second run)', async () => {
    const db = makeDb(0);
    const result = await gcExpiredProvenance(db, new Date());
    expect(result.deleted).toBe(0);
  });

  it('uses now() default when no argument passed', async () => {
    const db = makeDb(0);
    await gcExpiredProvenance(db);
    // biome-ignore lint/suspicious/noExplicitAny: reading the mock call args
    const call = (db.idpChangeProvenance.deleteMany as any).mock.calls[0][0];
    const cutoff = call.where.initiatedAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(89.9 * 24 * 60 * 60 * 1000);
    expect(Date.now() - cutoff.getTime()).toBeLessThan(90.1 * 24 * 60 * 60 * 1000);
  });
});
