/**
 * Unit tests for the advisory-lock helpers.
 *
 * The helpers must:
 *  - Emit only the namespaced two-arg `pg_advisory_xact_lock(classId, hashtext(key))`
 *    SQL form (no legacy single-arg fallback).
 *  - Return the `acquired` boolean from the Postgres response for `try*` variants.
 *  - Use the stable `class_id` per namespace (cron=1, org=2, payment=3, sync=4).
 *
 * The dual-hold transition shim previously gated by
 * `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` was removed pre-launch (see
 * `.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md` §3.2 footnote); the app was
 * never deployed to production, so the env var was never set in any
 * environment and the shim was dead code from day one.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  acquireXactLock,
  releaseAdvisoryLock,
  tryAcquireAdvisoryLock,
  tryAcquireXactLock,
} from '../advisory-lock';

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

describe('advisory-lock — session-level helpers', () => {
  it('tryAcquireAdvisoryLock emits the namespaced two-arg SQL', async () => {
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

  it('tryAcquireAdvisoryLock returns false when Postgres reports not acquired', async () => {
    const db = makeDb();
    db.$queryRawUnsafe.mockResolvedValue([{ acquired: false }]);

    const ok = await tryAcquireAdvisoryLock(db, 'sync', 'ksef:conn-1');

    expect(ok).toBe(false);
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('releaseAdvisoryLock emits the namespaced two-arg unlock SQL', async () => {
    const db = makeDb();

    await releaseAdvisoryLock(db, 'cron', 'reminders');

    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1, hashtext($2))',
      1, // cron class_id
      'reminders',
    );
  });
});

describe('advisory-lock — transaction-scoped helpers', () => {
  it('acquireXactLock emits the namespaced two-arg SQL', async () => {
    const db = makeDb();

    await acquireXactLock(db, 'payment', 'org-1');

    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      3, // payment class_id
      'org-1',
    );
  });

  it('tryAcquireXactLock emits the namespaced two-arg SQL', async () => {
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

  it('tryAcquireXactLock returns false when Postgres reports not acquired', async () => {
    const db = makeDb();
    db.$queryRawUnsafe.mockResolvedValue([{ acquired: false }]);

    const ok = await tryAcquireXactLock(db, 'org', 'org-5');

    expect(ok).toBe(false);
    // xact locks auto-release on commit/rollback — no manual unlock needed.
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('uses the correct class_id for each namespace', async () => {
    const expected: [Parameters<typeof acquireXactLock>[1], number][] = [
      ['cron', 1],
      ['org', 2],
      ['payment', 3],
      ['sync', 4],
    ];

    for (const [namespace, classId] of expected) {
      const db = makeDb();
      await acquireXactLock(db, namespace, 'key');
      expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock($1, hashtext($2))',
        classId,
        'key',
      );
    }
  });
});
