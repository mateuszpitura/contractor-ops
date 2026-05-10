/**
 * Unit tests for the advisory-lock helpers — focused on the transition shim
 * gated by `ADVISORY_LOCK_TRANSITION_DUAL_HOLD`.
 *
 * The shim must:
 *  - Issue the legacy single-arg SQL first, then the new two-arg SQL.
 *  - In `try*` variants, short-circuit when the legacy lock is unavailable.
 *  - In `tryAcquireAdvisoryLock` (session-level), release the legacy lock if
 *    the new lock fails, otherwise it would leak for the session lifetime.
 *  - In xact-scoped variants, rely on tx commit/rollback to auto-release.
 *  - When the env var is unset, emit only the new two-arg SQL — no overhead.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_FLAG = 'ADVISORY_LOCK_TRANSITION_DUAL_HOLD';

interface MockDb {
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
}

function makeDb(): MockDb {
  return {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(async () => undefined),
  };
}

async function importHelpers() {
  vi.resetModules();
  return await import('../advisory-lock.js');
}

describe('advisory-lock — transition shim disabled (env unset)', () => {
  beforeEach(() => {
    delete process.env[ENV_FLAG];
  });

  it('tryAcquireXactLock emits only the new two-arg SQL', async () => {
    const { tryAcquireXactLock } = await importHelpers();
    const db = makeDb();
    db.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);

    const ok = await tryAcquireXactLock(db, 'cron', 'reminders');

    expect(ok).toBe(true);
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_xact_lock($1, hashtext($2)) AS acquired',
      1, // cron class_id
      'reminders',
    );
  });

  it('acquireXactLock emits only the new two-arg SQL', async () => {
    const { acquireXactLock } = await importHelpers();
    const db = makeDb();

    await acquireXactLock(db, 'payment', 'org-1');

    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      3, // payment class_id
      'org-1',
    );
  });

  it('tryAcquireAdvisoryLock emits only the new two-arg SQL', async () => {
    const { tryAcquireAdvisoryLock } = await importHelpers();
    const db = makeDb();
    db.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);

    const ok = await tryAcquireAdvisoryLock(db, 'sync', 'ksef:conn-1');

    expect(ok).toBe(true);
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
      4, // sync class_id
      'ksef:conn-1',
    );
  });
});

describe('advisory-lock — transition shim enabled (env=true)', () => {
  beforeEach(() => {
    process.env[ENV_FLAG] = 'true';
  });

  afterEach(() => {
    delete process.env[ENV_FLAG];
  });

  describe('legacy key reconstruction', () => {
    it('cron namespace prefixes the key with "cron:"', async () => {
      const { acquireXactLock } = await importHelpers();
      const db = makeDb();

      await acquireXactLock(db, 'cron', 'reminders');

      expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'cron:reminders',
      );
    });

    it('payment namespace prefixes the key with "payment-run:"', async () => {
      const { acquireXactLock } = await importHelpers();
      const db = makeDb();

      await acquireXactLock(db, 'payment', 'org-9');

      expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'payment-run:org-9',
      );
    });

    it('org and sync namespaces pass the raw key through', async () => {
      const { acquireXactLock } = await importHelpers();
      const db = makeDb();

      await acquireXactLock(db, 'org', 'org-7');
      await acquireXactLock(db, 'sync', 'ksef:conn-2');

      expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
        1,
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'org-7',
      );
      expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
        3, // 1 = legacy(org), 2 = new(org), 3 = legacy(sync)
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'ksef:conn-2',
      );
    });
  });

  describe('acquireXactLock (blocking)', () => {
    it('takes legacy single-arg lock first, then new two-arg lock', async () => {
      const { acquireXactLock } = await importHelpers();
      const db = makeDb();

      await acquireXactLock(db, 'cron', 'reminders');

      expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
        1,
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'cron:reminders',
      );
      expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
        2,
        'SELECT pg_advisory_xact_lock($1, hashtext($2))',
        1,
        'reminders',
      );
    });
  });

  describe('tryAcquireXactLock (non-blocking)', () => {
    it('short-circuits when the legacy lock is unavailable', async () => {
      const { tryAcquireXactLock } = await importHelpers();
      const db = makeDb();
      db.$queryRawUnsafe.mockResolvedValueOnce([{ acquired: false }]);

      const ok = await tryAcquireXactLock(db, 'cron', 'reminders');

      expect(ok).toBe(false);
      // Only the legacy try fired; the new lock was never attempted.
      expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',
        'cron:reminders',
      );
    });

    it('acquires both legacy and new locks on the happy path', async () => {
      const { tryAcquireXactLock } = await importHelpers();
      const db = makeDb();
      db.$queryRawUnsafe
        .mockResolvedValueOnce([{ acquired: true }]) // legacy
        .mockResolvedValueOnce([{ acquired: true }]); // new

      const ok = await tryAcquireXactLock(db, 'payment', 'org-3');

      expect(ok).toBe(true);
      expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(2);
      expect(db.$queryRawUnsafe).toHaveBeenNthCalledWith(
        1,
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',
        'payment-run:org-3',
      );
      expect(db.$queryRawUnsafe).toHaveBeenNthCalledWith(
        2,
        'SELECT pg_try_advisory_xact_lock($1, hashtext($2)) AS acquired',
        3,
        'org-3',
      );
    });

    it('returns false when legacy succeeds but new fails — tx commit releases the legacy lock', async () => {
      const { tryAcquireXactLock } = await importHelpers();
      const db = makeDb();
      db.$queryRawUnsafe
        .mockResolvedValueOnce([{ acquired: true }]) // legacy
        .mockResolvedValueOnce([{ acquired: false }]); // new

      const ok = await tryAcquireXactLock(db, 'org', 'org-5');

      expect(ok).toBe(false);
      // No manual unlock — xact locks release on tx commit/rollback.
      expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('tryAcquireAdvisoryLock (session-level)', () => {
    it('releases the legacy lock when the new lock fails (no session leak)', async () => {
      const { tryAcquireAdvisoryLock } = await importHelpers();
      const db = makeDb();
      db.$queryRawUnsafe
        .mockResolvedValueOnce([{ acquired: true }]) // legacy
        .mockResolvedValueOnce([{ acquired: false }]); // new

      const ok = await tryAcquireAdvisoryLock(db, 'sync', 'ksef:conn-1');

      expect(ok).toBe(false);
      expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1);
      expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock(hashtext($1))',
        'ksef:conn-1',
      );
    });

    it('returns true and emits both lock SQLs on the happy path', async () => {
      const { tryAcquireAdvisoryLock } = await importHelpers();
      const db = makeDb();
      db.$queryRawUnsafe
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce([{ acquired: true }]);

      const ok = await tryAcquireAdvisoryLock(db, 'sync', 'google-workspace:conn-2');

      expect(ok).toBe(true);
      expect(db.$queryRawUnsafe).toHaveBeenNthCalledWith(
        1,
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        'google-workspace:conn-2',
      );
      expect(db.$queryRawUnsafe).toHaveBeenNthCalledWith(
        2,
        'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
        4,
        'google-workspace:conn-2',
      );
      // Both locks held — no unlock fired.
      expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('releaseAdvisoryLock', () => {
    it('releases both the new and the legacy lock', async () => {
      const { releaseAdvisoryLock } = await importHelpers();
      const db = makeDb();

      await releaseAdvisoryLock(db, 'cron', 'reminders');

      expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      // New first, then legacy — both are best-effort; order matches the doc.
      expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
        1,
        'SELECT pg_advisory_unlock($1, hashtext($2))',
        1,
        'reminders',
      );
      expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
        2,
        'SELECT pg_advisory_unlock(hashtext($1))',
        'cron:reminders',
      );
    });
  });
});
