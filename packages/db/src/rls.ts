import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from './generated/prisma/client/client.js';

export type RlsContext = {
  organizationId: string;
  userId: string;
};

/**
 * Re-entrancy guard for {@link withRlsReads}. Set to `true` while a query is
 * already executing inside an RLS-scoped `$transaction`, so the per-model
 * extension hooks short-circuit instead of opening another (recursive) tx.
 *
 * Module-private: callers must not import this directly.
 */
const rlsReadActive = new AsyncLocalStorage<true>();

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
// RLS defense-in-depth via $transaction wrapping
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
 *     codebase.
 *   - Pass-through transactions (no callback) are not affected.
 *   - Defense-in-depth ONLY — RLS policies are not yet defined in the
 *     schema. The SET LOCAL is a no-op until policies exist; no behaviour
 *     change today.
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

// ---------------------------------------------------------------------------
// Scoped RLS read-path extension
// ---------------------------------------------------------------------------

/**
 * The list of high-blast-radius models whose READ operations are wrapped in a
 * one-shot `$transaction` with `SET LOCAL app.org_id = ...` so that any future
 * Postgres RLS policy gets the org id even on plain reads.
 *
 * Selection rationale (locked decision): these are the models where a missed
 * `where: { organizationId }` is the highest-impact data exposure (file
 * downloads → IDOR → cross-tenant documents; financial records; identity rows;
 * approval state; user-targeted notifications). Other tenant-scoped models keep
 * the pure-read fast path (still scoped via the Prisma tenant extension; just
 * no DB-level second guard).
 *
 * Trade-off: each wrapped read costs +1 RTT to open a tx and +2 statements
 * for `set_config(...)`. We accept this on these tables because the alternative
 * — wrapping every model — adds the same cost to dashboards/lists that already
 * dominate p50 latency, and the org-meta cache work doesn't help reads that are
 * not on the hot path.
 *
 * `Member` is intentionally EXCLUDED even though the audit listed it: Member
 * is in `globalModels` (cross-org auth flows like the org-switcher list-by-user
 * traverse it without a tenant context), so wrapping it in SET LOCAL would
 * either no-op or — once policies exist — break legitimate global queries.
 */
export const RLS_READ_SCOPED_MODELS = [
  'document',
  'invoice',
  'contractor',
  'approvalStep',
  'notification',
] as const;

export type RlsReadScopedModel = (typeof RLS_READ_SCOPED_MODELS)[number];

/** READ operations we wrap (write-path is covered by `withRlsTransactions`). */
const RLS_READ_OPERATIONS = ['findMany', 'findFirst', 'findUnique', 'count'] as const;

type PrismaExtensible = {
  // biome-ignore lint/suspicious/noExplicitAny: matches Prisma's $extends overload.
  $extends: (...args: any[]) => unknown;
};

type AnyDelegate = Record<string, (args: unknown) => Promise<unknown>>;

type TxLike = {
  $executeRaw: (query: Prisma.Sql) => Promise<unknown>;
} & Record<string, AnyDelegate>;

interface ReadHookParams {
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

/**
 * Wraps READ operations on {@link RLS_READ_SCOPED_MODELS} so they execute
 * inside a `$transaction` with `SET LOCAL app.org_id` (+ `app.user_id`) issued
 * as the first statement. Defense-in-depth for the eventual Postgres RLS
 * policies tracked in the audit log.
 *
 * Re-entrancy: when a hook fires while {@link rlsReadActive} is already set
 * (i.e. we're already inside a wrapped tx), we short-circuit to `query(args)`
 * — otherwise re-issuing the read against the tx would recursively re-enter
 * this same hook and deadlock.
 *
 * Why a re-entrancy guard rather than just bypassing extensions on `tx`:
 * Prisma 7's interactive `$transaction` yields an extended `tx` whose `query`
 * hooks are still bound to this layer. Calling `tx[model][op](args)` inside
 * the hook re-triggers the hook unless the guard is set.
 *
 * Test environments that pass a non-Prisma mock (no `$extends`) get a
 * pass-through — this matches the pattern used by `withOrgCacheInvalidation`
 * in the api package.
 */
export function withRlsReads<T extends PrismaExtensible & PrismaWithTransaction>(
  prisma: T,
  ctx: RlsContext,
): T {
  if (typeof (prisma as { $extends?: unknown }).$extends !== 'function') {
    return prisma;
  }

  const makeHook = (model: RlsReadScopedModel, op: (typeof RLS_READ_OPERATIONS)[number]) => {
    return async ({ args, query }: ReadHookParams): Promise<unknown> => {
      // Already inside an RLS tx — don't open another. Just continue down
      // the extension chain (tenantScope, softDelete, …).
      if (rlsReadActive.getStore()) {
        return query(args);
      }

      return rlsReadActive.run(true, async () =>
        // Use the wrapped client's `$transaction` so the user gets the same
        // tx semantics as everywhere else (pgbouncer-friendly, retries, …).
        // Cast through unknown because Prisma's `$transaction` overload union
        // is wider than what we exercise here.
        (prisma as PrismaWithTransaction).$transaction(async (txUnknown: unknown) => {
          const tx = txUnknown as TxLike;
          await withRlsSession(tx, ctx);
          const delegate = tx[model] as AnyDelegate | undefined;
          if (!delegate) {
            // Defensive: if the model delegate is somehow missing on the tx
            // (e.g. test mocks), fall back to the original query.
            return query(args);
          }
          // Re-issue the read against the tx. The extension chain re-fires
          // but the re-entrancy guard above forwards directly to `query`.
          return delegate[op](args);
        }),
      );
    };
  };

  const queryConfig: Record<string, Record<string, unknown>> = {};
  for (const model of RLS_READ_SCOPED_MODELS) {
    const perModel: Record<string, unknown> = {};
    for (const op of RLS_READ_OPERATIONS) {
      perModel[op] = makeHook(model, op);
    }
    queryConfig[model] = perModel;
  }

  // biome-ignore lint/suspicious/noExplicitAny: $extends config typing is generic over models.
  return (prisma as PrismaExtensible).$extends({ query: queryConfig as any }) as T;
}
