// ---------------------------------------------------------------------------
// F-SCALE-06 — read-replica routing (Phase 3 Tier-2)
// ---------------------------------------------------------------------------
//
// Optional per-region read replica. When `DATABASE_URL_<REGION>_RO` is set,
// the helpers here return a second PrismaClient bound to that connection
// string; otherwise they transparently fall back to the writer returned by
// `getRegionalClient(region)`.
//
// Design (locked, see /.audit-2026-05-03/06-scalability.md and the per-agent
// brief in `.planning/`):
//
//   - **Explicit opt-in**, not transparent `$extends({ query })` rewriting.
//     Every call site that opts into the replica accepts the lag tolerance
//     trade-off explicitly. Mutations and `$transaction` always go to the
//     writer.
//   - **Best-effort with writer fallback.** If the replica's underlying call
//     throws (connection refused, replica lag query timeout, etc.), the
//     `readReplica` helper logs a Pino warn (which Sentry/Axiom pick up as a
//     breadcrumb) and re-runs the work on the writer. A replica outage
//     therefore degrades to writer load instead of propagating an error.
//   - **Per-region circuit breaker.** When the replica fails 5+ times within
//     the rolling 60s window, opossum trips and forces all subsequent reads
//     to the writer for `RESET_TIMEOUT_MS` (default 30s). Once the breaker
//     half-opens, the next read is allowed to probe the replica again.
//   - **Composes with `getRegionalClient`** — they do not conflict. The
//     writer pool stays under `region.ts`; the replica pool lives here. A
//     replica is keyed by region (`EU`/`ME`) and is **never** mixed into the
//     writer cache so existing call sites that need write access continue to
//     resolve the writer regardless of replica configuration.
//
// Lag tolerance — caller responsibility
// =====================================
//
// Neon's logical replicas typically settle within 50-200ms behind the
// writer for normal write traffic. Specific call sites MUST verify that
// their UX can tolerate this (i.e. no read-after-write within the same
// request). Safe consumers:
//   - aggregate/dashboard KPIs (single-digit-second tolerance)
//   - report exports (background jobs)
//   - search indexes
//
// Unsafe consumers (always use the writer):
//   - any read that follows a mutation in the same request
//   - audit-trail reads where regulators demand strict consistency
//   - billing-ledger queries
//
// Subsequent consumers opt in by importing `readReplica` and wrapping a
// scoped block (NOT a single query) so multiple related reads share the
// same fallback decision:
//
// ```ts
// // F-SCALE-06: kpis tolerate ~1s of replica lag.
// const kpis = await readReplica(ctx.region, async db => {
//   const [a, b] = await Promise.all([db.contract.count(...), db.invoice.count(...)]);
//   return { a, b };
// });
// ```
// ---------------------------------------------------------------------------

import { createLogger } from '@contractor-ops/logger';
import CircuitBreaker from 'opossum';
import { createPrismaClientForUrl } from './client.js';
import type { PrismaClient } from './generated/prisma/client/client.js';
import type { DataRegion } from './region.js';
import { getRegionalClient, SUPPORTED_REGIONS } from './region.js';

// ---------------------------------------------------------------------------
// Region → replica env var mapping
// ---------------------------------------------------------------------------

const REPLICA_ENV_MAP: Record<DataRegion, string> = {
  EU: 'DATABASE_URL_EU_RO',
  ME: 'DATABASE_URL_ME_RO',
};

// ---------------------------------------------------------------------------
// Pool of replica clients (cached on globalThis for HMR safety)
// ---------------------------------------------------------------------------

const globalForReplicas = globalThis as unknown as {
  replicaClients: Map<DataRegion, PrismaClient> | undefined;
  replicaBreakers: Map<DataRegion, CircuitBreaker<unknown[], unknown>> | undefined;
};

function getReplicaPool(): Map<DataRegion, PrismaClient> {
  if (!globalForReplicas.replicaClients) {
    globalForReplicas.replicaClients = new Map();
  }
  return globalForReplicas.replicaClients;
}

function getBreakerPool(): Map<DataRegion, CircuitBreaker<unknown[], unknown>> {
  if (!globalForReplicas.replicaBreakers) {
    globalForReplicas.replicaBreakers = new Map();
  }
  return globalForReplicas.replicaBreakers;
}

const replicaLog = createLogger({ service: 'db-replica' });

// ---------------------------------------------------------------------------
// Circuit breaker config (per region)
// ---------------------------------------------------------------------------

const FAILURE_VOLUME_THRESHOLD = 5; // 5 errors before threshold can trip
const ERROR_THRESHOLD_PERCENTAGE = 50; // ≥50% errors over the rolling window
const ROLLING_COUNT_TIMEOUT_MS = 60_000; // 60s rolling window
const ROLLING_COUNT_BUCKETS = 10;
const RESET_TIMEOUT_MS = 30_000; // 30s open → half-open

/**
 * Lazily constructs the per-region replica circuit breaker. Returns the
 * cached instance on subsequent calls. Each breaker observes only replica
 * calls — writer traffic never flows through it.
 */
function getBreaker(region: DataRegion): CircuitBreaker<unknown[], unknown> {
  const pool = getBreakerPool();
  const cached = pool.get(region);
  if (cached) return cached;

  // The action is identity: opossum just observes the success/failure of the
  // inner call and trips when it sees too many failures. We never let the
  // breaker reject "downstream" — `readReplica` checks the breaker state
  // itself and routes to the writer when the breaker is open / half-open.
  type ReplicaCall = (...args: unknown[]) => Promise<unknown>;
  const action: ReplicaCall = call => (call as () => Promise<unknown>)();

  const breaker = new CircuitBreaker<unknown[], unknown>(action, {
    name: `db-replica-${region}`,
    volumeThreshold: FAILURE_VOLUME_THRESHOLD,
    errorThresholdPercentage: ERROR_THRESHOLD_PERCENTAGE,
    rollingCountTimeout: ROLLING_COUNT_TIMEOUT_MS,
    rollingCountBuckets: ROLLING_COUNT_BUCKETS,
    resetTimeout: RESET_TIMEOUT_MS,
    // Disable opossum's own timeout — Prisma's per-query timeout is the
    // source of truth for "took too long".
    timeout: false,
  });

  breaker.on('open', () => {
    replicaLog.warn(
      { region, event: 'db_replica.circuit_open', resetMs: RESET_TIMEOUT_MS },
      'read replica circuit breaker opened — routing reads to writer',
    );
  });
  breaker.on('halfOpen', () => {
    replicaLog.info(
      { region, event: 'db_replica.circuit_half_open' },
      'read replica circuit breaker half-open — probing replica',
    );
  });
  breaker.on('close', () => {
    replicaLog.info(
      { region, event: 'db_replica.circuit_close' },
      'read replica circuit breaker closed — replica recovered',
    );
  });

  pool.set(region, breaker);
  return breaker;
}

/**
 * @internal Test seam — clears every cached replica client + breaker.
 * Production code never calls this; it exists so unit tests can simulate a
 * fresh process between cases without touching `globalThis` directly.
 */
export function resetReplicaStateForTests(): void {
  const breakerPool = getBreakerPool();
  for (const breaker of breakerPool.values()) {
    breaker.shutdown();
  }
  breakerPool.clear();
  getReplicaPool().clear();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a replica `PrismaClient` for the given region when:
 *   1. `DATABASE_URL_<REGION>_RO` is set.
 *   2. The per-region circuit breaker is closed (or half-open and the next
 *      probe is allowed).
 *
 * Otherwise returns the writer client from `getRegionalClient(region)`.
 *
 * Note that this returns the raw `PrismaClient` — callers usually want
 * `readReplica()` instead, which threads errors through the breaker and
 * automatically falls back to the writer on replica errors.
 */
export function getReplicaClient(region: DataRegion): PrismaClient {
  if (!SUPPORTED_REGIONS.includes(region)) {
    throw new Error(
      `Unsupported data region: ${region}. Supported: ${SUPPORTED_REGIONS.join(', ')}`,
    );
  }

  const envVar = REPLICA_ENV_MAP[region];
  const connectionString = process.env[envVar];

  // No replica configured for this region → writer.
  if (!connectionString) {
    return getRegionalClient(region);
  }

  const breaker = getBreaker(region);
  // When the breaker is open, do NOT even attempt the replica — every call
  // would short-circuit anyway, so we save the no-op breaker.fire().
  if (breaker.opened) {
    return getRegionalClient(region);
  }

  const pool = getReplicaPool();
  const cached = pool.get(region);
  if (cached) return cached;

  const client = createPrismaClientForUrl(connectionString);
  pool.set(region, client);
  return client;
}

/**
 * Best-effort replica read. Runs `fn` against the region's replica when
 * configured + healthy; falls back to the writer (and logs a warn line) when
 * the replica is unconfigured, the breaker is open, or the call throws.
 *
 * **Lag tolerance is caller-decided.** Wrap a logical group of reads — not a
 * single query — so all related reads share the same fallback decision and
 * the breaker observes one event per logical request.
 *
 * The returned `db` argument is a raw `PrismaClient`. Tenant scoping (org
 * isolation, soft-delete) is the caller's responsibility — typically you'd
 * pass the writer-scoped `ctx.db` instead and only use this helper for raw
 * `$queryRaw` aggregates that already spell out predicates explicitly.
 *
 * @example
 *   // F-SCALE-06: kpis tolerate ~1s lag.
 *   const counts = await readReplica('EU', async db =>
 *     db.$queryRaw`SELECT COUNT(*) FROM "Contract" WHERE …`,
 *   );
 */
export async function readReplica<T>(
  region: DataRegion,
  fn: (db: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!SUPPORTED_REGIONS.includes(region)) {
    throw new Error(
      `Unsupported data region: ${region}. Supported: ${SUPPORTED_REGIONS.join(', ')}`,
    );
  }

  const envVar = REPLICA_ENV_MAP[region];
  const replicaUrl = process.env[envVar];

  // No replica configured → straight to writer (no breaker churn).
  if (!replicaUrl) {
    return fn(getRegionalClient(region));
  }

  const breaker = getBreaker(region);

  // If breaker is open, skip the replica entirely.
  if (breaker.opened) {
    replicaLog.debug(
      { region, event: 'db_replica.skip_open' },
      'replica breaker open — using writer',
    );
    return fn(getRegionalClient(region));
  }

  const replica = getReplicaClient(region);

  try {
    // Wrap the replica call in `breaker.fire(...)` so the breaker observes
    // success/failure. Casting through `unknown` because opossum's generic
    // ergonomics are awkward when the action takes one arg.
    const result = await breaker.fire(
      (() => fn(replica)) as unknown as (...args: unknown[]) => Promise<unknown>,
    );
    return result as T;
  } catch (err) {
    // Replica failed (or was rejected by breaker after this branch checked).
    // Log + degrade to writer. The breaker has already counted the failure
    // for state purposes via `breaker.fire`'s telemetry hooks.
    replicaLog.warn(
      {
        region,
        event: 'db_replica.fallback_writer',
        err: err instanceof Error ? { name: err.name, message: err.message } : err,
      },
      'read replica error — falling back to writer (Sentry/Axiom breadcrumb)',
    );
    return fn(getRegionalClient(region));
  }
}
