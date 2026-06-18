import { describe, expect, it, vi } from 'vitest';
import {
  allowAuditPurge,
  RLS_READ_SCOPED_MODELS,
  withRlsReads,
  withRlsSession,
  withRlsTransactions,
} from '../rls.js';

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
// allowAuditPurge opts the tx into the gated AuditLog DELETE policy.
// ---------------------------------------------------------------------------

describe('allowAuditPurge', () => {
  it('sets the transaction-local app.allow_audit_purge flag to on', async () => {
    const executeCalls: unknown[] = [];
    const tx = {
      $executeRaw: vi.fn(async (q: unknown) => {
        executeCalls.push(q);
      }),
    };

    await allowAuditPurge(tx as never);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const sql = executeCalls[0] as { strings?: string[] };
    const text = sql?.strings?.join('?');
    expect(text).toContain('set_config');
    expect(text).toContain('app.allow_audit_purge');
    // Enabled with the literal 'on' value, transaction-local (third arg `true`).
    expect(text).toContain("'on'");
    expect(text).toContain('true');
  });
});

// ---------------------------------------------------------------------------
// withRlsTransactions wraps the callback overload of $transaction.
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

// ---------------------------------------------------------------------------
// withRlsReads scoped read-path RLS
// ---------------------------------------------------------------------------

describe('withRlsReads', () => {
  it('declares the locked set of high-blast-radius models', () => {
    // Lock the scope — changing this must be a deliberate, audited decision.
    expect([...RLS_READ_SCOPED_MODELS].sort()).toEqual([
      'approvalStep',
      'contractor',
      'document',
      'invoice',
      'notification',
    ]);
  });

  it('returns the input verbatim when $extends is unavailable (test mocks)', () => {
    const fake = { $transaction: vi.fn() };
    const out = withRlsReads(fake, { organizationId: 'o', userId: 'u' });
    expect(out).toBe(fake);
  });

  it('wraps a scoped-model findMany in a tx that issues SET LOCAL first', async () => {
    type ExtensionConfig = {
      query: Record<
        string,
        Record<
          string,
          (p: { args: unknown; query: (a: unknown) => Promise<unknown> }) => Promise<unknown>
        >
      >;
    };

    let registered: ExtensionConfig | null = null;
    const txExecuted: unknown[] = [];

    // Inner tx delegate — the real Prisma tx surface that our hook
    // re-issues the read against. Tracks call order so we can assert
    // SET LOCAL fires BEFORE the read.
    const callOrder: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async (q: unknown) => {
        callOrder.push('set_config');
        txExecuted.push(q);
      }),
      contractor: {
        findMany: vi.fn(async (_args: unknown) => {
          callOrder.push('findMany');
          return ['c-1', 'c-2'];
        }),
      },
    };

    const baseClient = {
      $extends: (cfg: ExtensionConfig) => {
        registered = cfg;
        // Return a synthetic extended client whose `contractor.findMany`
        // forwards into the registered hook (mirroring what Prisma does).
        return {
          $transaction: vi.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) => fn(tx)),
          contractor: {
            findMany: (args: unknown) =>
              cfg.query.contractor.findMany({
                args,
                // The "downstream" query is the original delegate call —
                // here we just return a sentinel so we can detect bypass.
                query: async () => 'BYPASS',
              }),
          },
        };
      },
      $transaction: vi.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const extended = withRlsReads(baseClient, {
      organizationId: 'org-a',
      userId: 'user-a',
    });

    // Sanity: extension was registered for the scoped models we expect.
    expect(registered).not.toBeNull();
    const cfg = registered as unknown as ExtensionConfig;
    for (const m of RLS_READ_SCOPED_MODELS) {
      expect(cfg.query[m]).toBeDefined();
      expect(typeof cfg.query[m]?.findMany).toBe('function');
      expect(typeof cfg.query[m]?.findFirst).toBe('function');
      expect(typeof cfg.query[m]?.findUnique).toBe('function');
      expect(typeof cfg.query[m]?.count).toBe('function');
    }

    const result = await (
      extended as unknown as {
        contractor: { findMany: (a: unknown) => Promise<string[]> };
      }
    ).contractor.findMany({ where: { id: 'c-1' } });

    expect(result).toEqual(['c-1', 'c-2']);
    // SET LOCAL ran first (org_id + user_id), THEN the read.
    expect(callOrder).toEqual(['set_config', 'set_config', 'findMany']);
  });

  it('short-circuits to query() when invoked re-entrantly inside an active tx', async () => {
    // Simulate the tx-internal re-entry: when the hook re-issues the read
    // against `tx.contractor.findMany`, the extension chain fires the hook
    // AGAIN. The re-entrancy guard must short-circuit to `query(args)` so
    // we don't open another nested $transaction.
    type ExtensionConfig = {
      query: Record<
        string,
        Record<
          string,
          (p: { args: unknown; query: (a: unknown) => Promise<unknown> }) => Promise<unknown>
        >
      >;
    };

    let registered: ExtensionConfig | null = null;

    const tx = {
      $executeRaw: vi.fn(async () => undefined),
      contractor: {
        // The "real" delegate on tx — when called by the re-entrant hook,
        // it calls cfg.query.contractor.findMany again with the guard set.
        findMany: vi.fn(async (args: unknown) => {
          if (!registered) throw new Error('cfg not registered');
          return registered.query.contractor.findMany({
            args,
            query: async (a: unknown) => ({ bypass: true, args: a }),
          });
        }),
      },
    };

    let txCallCount = 0;
    const baseClient = {
      $extends: (cfg: ExtensionConfig) => {
        registered = cfg;
        return {
          $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
            txCallCount++;
            return fn(tx);
          }),
          contractor: {
            findMany: (args: unknown) =>
              cfg.query.contractor.findMany({
                args,
                query: async () => 'OUTER_BYPASS',
              }),
          },
        };
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        txCallCount++;
        return fn(tx);
      }),
    };

    const extended = withRlsReads(baseClient, {
      organizationId: 'org-r',
      userId: 'user-r',
    });

    const result = await (
      extended as unknown as {
        contractor: { findMany: (a: unknown) => Promise<unknown> };
      }
    ).contractor.findMany({ where: { id: 'x' } });

    // Inner re-entry must hit the bypass branch (query callback).
    expect(result).toEqual({ bypass: true, args: { where: { id: 'x' } } });
    // Exactly ONE $transaction was opened — no recursion.
    expect(txCallCount).toBe(1);
  });
});
