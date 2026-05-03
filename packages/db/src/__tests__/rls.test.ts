import { describe, expect, it, vi } from 'vitest';
import { withRlsSession, withRlsTransactions } from '../rls.js';

describe('withRlsSession', () => {
  it('sets app.org_id and app.user_id via set_config', async () => {
    const executeCalls: unknown[] = [];
    const tx = {
      $executeRaw: vi.fn(async (q: unknown) => {
        executeCalls.push(q);
      }),
    };

    await withRlsSession(tx as never, {
      organizationId: 'org-42',
      userId: 'user-99',
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    const sql0 = executeCalls[0] as { strings?: string[] };
    const s0 = sql0?.strings?.join('?');
    expect(s0).toContain('set_config');
    expect(s0).toContain('app.org_id');

    const sql1 = executeCalls[1] as { strings?: string[] };
    const s1 = sql1?.strings?.join('?');
    expect(s1).toContain('set_config');
    expect(s1).toContain('app.user_id');
  });
});

// ---------------------------------------------------------------------------
// F-DB-04 — withRlsTransactions wraps the callback overload of $transaction.
// ---------------------------------------------------------------------------

describe('withRlsTransactions', () => {
  it('emits SET LOCAL as the first statement inside an interactive transaction', async () => {
    const executed: unknown[] = [];
    const fakeTx = {
      $executeRaw: vi.fn(async (q: unknown) => {
        executed.push(q);
      }),
      contractor: { findMany: vi.fn(async () => ['row1']) },
    };

    const baseClient = {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx)),
    };

    const wrapped = withRlsTransactions(baseClient, {
      organizationId: 'org-rls',
      userId: 'user-rls',
    });

    const result = await (
      wrapped as unknown as {
        $transaction: (fn: (tx: typeof fakeTx) => Promise<unknown>) => Promise<unknown>;
      }
    ).$transaction(async tx => {
      // Caller's "real" query — must run AFTER set_config.
      return tx.contractor.findMany();
    });

    expect(result).toEqual(['row1']);
    // Two `set_config` calls (org_id + user_id) precede the contractor.findMany.
    expect(fakeTx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(fakeTx.contractor.findMany).toHaveBeenCalledTimes(1);

    const firstSql = executed[0] as { strings?: string[] };
    const firstText = firstSql?.strings?.join('?');
    expect(firstText).toContain('set_config');
    expect(firstText).toContain('app.org_id');
  });

  it('passes the array overload of $transaction through untouched', async () => {
    const baseClient = {
      $transaction: vi.fn(async (queries: unknown[]) => queries.map((_, i) => `r${i}`)),
    };

    const wrapped = withRlsTransactions(baseClient, {
      organizationId: 'org',
      userId: 'user',
    });

    const fakeQueries: unknown[] = [{ kind: 'q1' }, { kind: 'q2' }];
    const result = await (
      wrapped as unknown as { $transaction: (a: unknown[]) => Promise<string[]> }
    ).$transaction(fakeQueries);

    expect(result).toEqual(['r0', 'r1']);
    // The array overload should NOT have a SET LOCAL injected — Prisma does
    // not let us splice statements into a sequenced batch.
    expect(baseClient.$transaction).toHaveBeenCalledWith(fakeQueries, undefined);
  });

  it('preserves non-$transaction client surface (Proxy passthrough)', () => {
    const probe = vi.fn(() => 'ping-pong');
    const baseClient = {
      $transaction: vi.fn(),
      probe,
    };

    const wrapped = withRlsTransactions(baseClient, {
      organizationId: 'o',
      userId: 'u',
    });

    expect((wrapped as unknown as { probe: () => string }).probe()).toBe('ping-pong');
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
