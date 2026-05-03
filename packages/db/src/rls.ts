import { Prisma } from './generated/prisma/client/client.js';

export type RlsContext = {
  organizationId: string;
  userId: string;
};

/**
 * Sets Postgres session variables used by RLS policies.
 *
 * Must be called inside the same transaction that will run queries
 * (uses `set_config(..., true)` == SET LOCAL).
 */
export async function withRlsSession(
  tx: { $executeRaw: (query: Prisma.Sql) => Promise<unknown> },
  ctx: RlsContext,
) {
  await tx.$executeRaw(Prisma.sql`select set_config('app.org_id', ${ctx.organizationId}, true)`);
  await tx.$executeRaw(Prisma.sql`select set_config('app.user_id', ${ctx.userId}, true)`);
}

// ---------------------------------------------------------------------------
// F-DB-04 — RLS defense-in-depth via $transaction wrapping
// ---------------------------------------------------------------------------

/**
 * Minimal structural shape of the Prisma `$transaction` family used by the
 * wrapper. We don't model Prisma's overload signatures here — the wrapper
 * proxies through both the array and callback overloads — but we need
 * SOMETHING that accepts both shapes structurally. `unknown` for the first
 * arg is the cheapest match for "either an array of PrismaPromise or a
 * callback function".
 */
export interface PrismaWithTransaction {
  // biome-ignore lint/suspicious/noExplicitAny: matches Prisma's overload union.
  $transaction: (...args: any[]) => Promise<unknown>;
}

/**
 * Returns a wrapped client whose `$transaction(callback)` runs `SET LOCAL
 * app.org_id = ...` (+ optional user_id) as the FIRST statement inside the
 * transaction so any future `CREATE POLICY ... USING (organization_id =
 * current_setting('app.org_id'))` rules in the database have a guaranteed
 * value to read.
 *
 * The wrapper is structural (returns the original client cast to its own
 * type with a swapped `$transaction`). Existing call sites are unaffected
 * — the only observable difference is two extra `select set_config(...)`
 * statements at the start of every transaction.
 *
 * Important:
 *   - Only the **callback overload** of `$transaction` (interactive tx) is
 *     wrapped. The array overload (`prisma.$transaction([q1, q2])`) is left
 *     alone because Prisma does not let us inject a SET LOCAL into the
 *     middle of a sequenced batch — and array transactions are rare in this
 *     codebase (auditor F-DB-04).
 *   - Pass-through transactions (no callback) are not affected.
 *   - Defense-in-depth ONLY — RLS policies are not yet defined in the
 *     schema (deferred to a separate Phase 2 migration). The SET LOCAL is a
 *     no-op until policies exist; no behaviour change today.
 */
export function withRlsTransactions<T extends PrismaWithTransaction>(
  client: T,
  ctx: RlsContext,
): T {
  const original = client.$transaction.bind(client) as (...args: unknown[]) => Promise<unknown>;

  type TxClient = { $executeRaw: (query: Prisma.Sql) => Promise<unknown> };

  const wrapped = async (fnOrArgs: unknown, options?: unknown): Promise<unknown> => {
    // Array overload — pass through untouched (see jsdoc above).
    if (Array.isArray(fnOrArgs) || typeof fnOrArgs !== 'function') {
      return original(fnOrArgs, options);
    }

    const userFn = fnOrArgs as (tx: TxClient) => Promise<unknown>;

    return original(async (tx: TxClient) => {
      await withRlsSession(tx, ctx);
      return userFn(tx);
    }, options);
  };

  // Replace `$transaction` while preserving the rest of the client surface.
  // Cast keeps the original generic types — callers see no shape change.
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === '$transaction') return wrapped;
      return Reflect.get(target, prop, receiver);
    },
  }) as T;
}
