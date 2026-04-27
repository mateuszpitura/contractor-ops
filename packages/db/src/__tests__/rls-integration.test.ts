/**
 * RLS session-variable integration test
 *
 * Verifies that `withRlsSession` correctly writes Postgres session variables
 * that are readable inside the same transaction and that SET LOCAL scoping
 * is transaction-local (the value disappears after commit on a fresh query).
 *
 * REQUIREMENTS
 * ============
 * Set TEST_DATABASE_URL to a Neon-compatible connection string before running:
 *
 *   TEST_DATABASE_URL=postgresql://user:pass@host/db \
 *     pnpm --filter @contractor-ops/db test -- rls-integration.test.ts
 *
 * The Neon adapter is used deliberately — production runs on Neon, so the
 * test exercises the same driver-level behaviour as prod. TEST_DATABASE_URL
 * must therefore point to a Neon endpoint (a free Neon branch works fine).
 * A plain postgresql:// URL to a local postgres host will NOT work because
 * @neondatabase/serverless communicates over WebSocket.
 *
 * Plain-Postgres alternative (NOT enabled by default, to keep deps lean):
 * add `@prisma/adapter-pg` to packages/db devDependencies and swap
 * `PrismaNeon` + `connectionString` for `PrismaPg` + `connectionString` in
 * createTestClient below. The diff is two lines. Left to the team's call
 * whether the marginal value of plain-PG testing justifies the extra dep;
 * Neon branches are the path of least resistance given the prod stack.
 *
 * If TEST_DATABASE_URL is absent the entire suite is skipped automatically so
 * CI machines without a real DB remain green.
 *
 * No migrations or schema changes are made. The tests only call set_config /
 * current_setting inside transactions, which is schema-independent.
 */

import { PrismaNeon } from '@prisma/adapter-neon';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/prisma/client/client.js';
import { withRlsSession } from '../rls.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestClient(url: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: url });
  return new PrismaClient({ adapter });
}

type Row = { value: string | null };

async function queryOrgId(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
): Promise<string | null> {
  const rows = await tx.$queryRaw<Row[]>`SELECT current_setting('app.org_id', true) AS value`;
  return rows[0]?.value ?? null;
}

async function queryUserId(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
): Promise<string | null> {
  const rows = await tx.$queryRaw<Row[]>`SELECT current_setting('app.user_id', true) AS value`;
  return rows[0]?.value ?? null;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

const hasDb = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDb)('withRlsSession — real Postgres integration', () => {
  const client = hasDb ? createTestClient(process.env.TEST_DATABASE_URL!) : null!;

  afterAll(async () => {
    if (client) {
      await client.$disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // 1. Sets app.org_id inside a transaction
  // -------------------------------------------------------------------------
  it('sets app.org_id in a transaction', async () => {
    const orgId = 'test-org-001';
    const userId = 'test-user-001';

    const result = await client.$transaction(async tx => {
      await withRlsSession(tx, { organizationId: orgId, userId });
      return queryOrgId(tx);
    });

    expect(result).toBe(orgId);
  });

  // -------------------------------------------------------------------------
  // 2. Sets app.user_id inside a transaction
  // -------------------------------------------------------------------------
  it('sets app.user_id in a transaction', async () => {
    const orgId = 'test-org-002';
    const userId = 'test-user-002';

    const result = await client.$transaction(async tx => {
      await withRlsSession(tx, { organizationId: orgId, userId });
      return queryUserId(tx);
    });

    expect(result).toBe(userId);
  });

  // -------------------------------------------------------------------------
  // 3. SET LOCAL scope: setting disappears after the transaction commits
  //
  // `set_config('app.org_id', value, true)` uses SET LOCAL which means the
  // session variable is valid only for the duration of the transaction.  After
  // the transaction commits the variable is unset on that connection.  The
  // subsequent raw query (outside any transaction) should see an empty string
  // (Postgres returns '' for unset parameters when the missing_ok flag is true).
  // -------------------------------------------------------------------------
  it('SET LOCAL scope — setting is absent after transaction commits', async () => {
    const orgId = 'test-org-leak';
    const userId = 'test-user-leak';

    // Run a transaction that writes the session var, then let it commit.
    await client.$transaction(async tx => {
      await withRlsSession(tx, { organizationId: orgId, userId });
    });

    // Now query outside any transaction.  The Neon adapter uses a connection
    // per interactive transaction, so this outer query runs on a fresh session
    // (or a session where the transaction has already committed and SET LOCAL is
    // no longer active).  Either way the value must not be 'test-org-leak'.
    const rows = await client.$queryRaw<Row[]>`SELECT current_setting('app.org_id', true) AS value`;
    const value = rows[0]?.value ?? null;

    // SET LOCAL guarantees the value does not persist beyond the transaction.
    // After commit current_setting returns '' (empty string) with missing_ok=true.
    const isAbsent = value === '' || value === null;
    expect(isAbsent).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Independent transactions have independent settings
  //
  // Two $transaction callbacks run with different orgIds.  Because each
  // interactive transaction gets its own Postgres connection and SET LOCAL is
  // scoped to that connection's current transaction, they cannot observe each
  // other's session variables.
  // -------------------------------------------------------------------------
  it('independent transactions have independent settings', async () => {
    const orgA = 'org-alpha';
    const orgB = 'org-beta';
    const userA = 'user-alpha';
    const userB = 'user-beta';

    // Run both transactions concurrently.
    const [resultA, resultB] = await Promise.all([
      client.$transaction(async tx => {
        await withRlsSession(tx, { organizationId: orgA, userId: userA });
        // Small pause to increase chance of overlap with the other transaction.
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        return queryOrgId(tx);
      }),
      client.$transaction(async tx => {
        await withRlsSession(tx, { organizationId: orgB, userId: userB });
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        return queryOrgId(tx);
      }),
    ]);

    expect(resultA).toBe(orgA);
    expect(resultB).toBe(orgB);
  });

  // -------------------------------------------------------------------------
  // 5. Empty string as orgId — observe and document behaviour
  //
  // Postgres accepts an empty string for set_config. current_setting will
  // return '' (empty string) rather than null.  The test does not assert that
  // this should be rejected; it merely documents the actual runtime behaviour
  // so a future caller can decide whether to add a guard at the call site.
  // -------------------------------------------------------------------------
  it('empty string orgId is stored verbatim (no runtime error)', async () => {
    const result = await client.$transaction(async tx => {
      // Should not throw.
      await withRlsSession(tx, { organizationId: '', userId: 'user-empty' });
      return queryOrgId(tx);
    });

    // Postgres stores '' as '' — not null.
    expect(result).toBe('');
  });

  // -------------------------------------------------------------------------
  // 6. SQL-injection safety
  //
  // `withRlsSession` uses Prisma.sql tagged template literals for both
  // set_config calls.  The organisationId is passed as a bound parameter, not
  // interpolated into the SQL string, so a malicious value is stored verbatim
  // and cannot escape into the query structure.
  // -------------------------------------------------------------------------
  it('SQL-injection attempt is stored verbatim without executing', async () => {
    const maliciousOrgId = `'; DROP TABLE x; --`;

    const result = await client.$transaction(async tx => {
      await withRlsSession(tx, { organizationId: maliciousOrgId, userId: 'user-inject' });
      return queryOrgId(tx);
    });

    // The full malicious string must be returned as-is — no truncation, no
    // injection, no error.  If Prisma had interpolated the value into raw SQL
    // this query would likely fail or return a different value.
    expect(result).toBe(maliciousOrgId);
  });
});
