// Transactional outbox service.
//
// Producers call `enqueueOutboxEvent({ tx, ... })` *inside* their existing
// `prisma.$transaction(...)` so the side effect is durably scheduled iff the
// triggering business write commits. A QStash schedule polls
// `/api/outbox/_drain` which calls `drainOutboxBatch()` to pick up to 100
// PENDING rows under `FOR UPDATE SKIP LOCKED` and dispatch them through the
// per-event handler registry in `./handlers.ts`.
//
// Idempotency contract for handlers:
//   - Each handler receives the OutboxEvent.id; it MUST pass that id as the
//     downstream provider's idempotency key (Stripe `idempotency_key`,
//     QStash `Upstash-Deduplication-Id`, Resend custom header). Re-delivery
//     of the same OutboxEvent.id MUST be a no-op for the downstream system.
//   - Handlers SHOULD be safe to invoke repeatedly. The drain exclusively
//     locks the row before invocation, so two workers won't dispatch the
//     same event in the same tick — but a worker that crashes mid-dispatch
//     leaves the row PENDING and the next tick will re-dispatch.
//
// Drain composition (2026-05-06 fix):
// The drain runs in three distinct phases, each with its own transactional
// scope, so that handler side-effects (Stripe, Resend, Slack) NEVER share a
// transaction with the row-status update:
//
//   1. CLAIM (short tx) — `SELECT … FOR UPDATE SKIP LOCKED` up to
//      DRAIN_BATCH_LIMIT rows, bump `attempts` and push `nextAttemptAt`
//      out by `CLAIM_WINDOW_MS`. Commit. A concurrent drainer's
//      `WHERE nextAttemptAt <= NOW()` predicate now skips these rows, so
//      we don't need an `IN_FLIGHT` enum value (avoids a schema migration).
//      A crashed worker recycles the row naturally on the next tick once
//      the claim window expires.
//   2. DISPATCH (no tx) — invoke `dispatchOutboxEvent` per claimed row.
//      Handler side-effects (Resend send, etc.) run here, OUTSIDE any
//      outer transaction. A handler crash leaves attempts already bumped
//      so the next attempt counts toward MAX_OUTBOX_ATTEMPTS.
//   3. FINALIZE (one short tx per row) — on success, set DISPATCHED. On
//      failure, either mark FAILED (if attempts hit MAX_OUTBOX_ATTEMPTS)
//      or schedule the next retry with exponential backoff.
//
// Retry policy: see `scheduleNextAttempt`. Exponential backoff with jitter,
// capped at 1 hour, max 5 attempts. After the final attempt the row is
// marked FAILED and a Sentry capture fires.
//
// Why 5 attempts (2026-05-06 fix)
// ============================================
// Each handler call goes through `withResilience` (packages/integrations),
// which already applies its own p-retry budget (typically 2-3 attempts +
// the original call) plus a circuit breaker. The outbox layer's retries
// COMPOUND with that inner budget — every outbox attempt fires up to
// `1 + retryAttempts` concrete provider calls.
//
//   Worst-case provider calls per outbox row
//   = MAX_OUTBOX_ATTEMPTS × (1 + provider.retryAttempts)
//
// At the previous MAX_OUTBOX_ATTEMPTS=10 with Resend's `retryAttempts: 3`
// (4 inner calls), one outbox row could burn 40 calls — material against
// Resend's 10/sec free-tier rate limit. Lowering to 5 caps the worst case
// at 5 × 4 = 20 calls per row, while still giving four exponential-backoff
// retries to absorb a sustained transient outage.
//
// See `packages/integrations/src/services/resilience.ts` for the per-
// provider math and the worked Resend example.

import { prismaRaw } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/node';
import { isDemoOrg } from '../../lib/demo';
import type { NotificationEvent } from '../notification-service';
import type { OutboxEventType } from './handlers';
import { dispatchOutboxEvent } from './handlers';

const log = createLogger({ service: 'outbox' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimum surface of a Prisma client / transaction we need for inserts.
 * Accepts both the global `prisma` binding and a `tx` interactive transaction
 * client. Methods use `$executeRaw` because the generated client's typed
 * model accessor doesn't yet know about the new `attempts` / `nextAttemptAt`
 * / `lastError` columns (they ship in the same schema migration as this
 * code).
 */
export interface OutboxTransactionalClient {
  $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
  $executeRawUnsafe: (query: string, ...values: readonly unknown[]) => Promise<number>;
}

export interface EnqueueOutboxEventInput<TPayload = Record<string, unknown>> {
  /**
   * The transactional client (interactive `tx` or the global prisma) the
   * producer is already using for its business write. Passing `tx` is the
   * whole point of the outbox: the row commits iff the rest of the
   * transaction commits.
   */
  tx: OutboxTransactionalClient;
  organizationId: string;
  eventType: OutboxEventType;
  payload: TPayload;
  /**
   * Optional natural-key dedup. When set, the row insert is `INSERT ... ON
   * CONFLICT (organizationId, dedupKey) DO NOTHING`, so a producer that
   * fires the same logical event twice is a no-op at the DB level. Use for
   * notification dedup: set to e.g.
   * `${recipientId}:${notificationType}:${entityId}:${dateBucket}`.
   */
  dedupKey?: string;
  aggregateType?: string;
  aggregateId?: string;
}

export interface DrainBatchResult {
  scanned: number;
  dispatched: number;
  failed: number;
  retried: number;
  exhausted: number;
}

interface OutboxEventRow {
  id: string;
  organizationId: string;
  eventType: string;
  payloadJson: unknown;
  attempts: number;
}

/**
 * A row that has been claimed by the current drainer (attempts already
 * incremented, nextAttemptAt pushed out by CLAIM_WINDOW_MS). The
 * `attemptNumber` field is the post-increment count — i.e. the attempt
 * we're about to perform.
 */
interface ClaimedOutboxRow {
  id: string;
  organizationId: string;
  eventType: string;
  payloadJson: unknown;
  attemptNumber: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * After this many attempts, mark FAILED and Sentry-capture.
 *
 * Lowered from 10 → 5 (2026-05-06): `withResilience` already
 * absorbs transient errors with its own p-retry budget, so the outbox
 * compounds with already-retried calls. See the docstring at the top of
 * this file and `packages/integrations/src/services/resilience.ts`.
 */
export const MAX_OUTBOX_ATTEMPTS = 5;

/** Per-tick batch cap. Keeps the worker bounded for serverless. */
export const DRAIN_BATCH_LIMIT = 100;

/** Exponential backoff cap. Re-delivery of a flapping handler shouldn't drift past 1h. */
const BACKOFF_MAX_MS = 60 * 60 * 1000;

/**
 * Base unit for exponential backoff: 4 minutes.
 *
 * Tuned in lockstep with MAX_OUTBOX_ATTEMPTS=5 so total time-to-give-up
 * stays near the original ~1h budget:
 *   wait_1 ≈ 4m, wait_2 ≈ 8m, wait_3 ≈ 16m, wait_4 ≈ 32m → ~60m total.
 * (Previously 60s base × 10 attempts hit the 1h cap at attempt 7.)
 */
const BACKOFF_BASE_MS = 4 * 60 * 1000;

/** Random extra jitter in (0, 30s] to spread thundering herds. */
const JITTER_MAX_MS = 30 * 1000;

/**
 * How long a claimed row is hidden from concurrent drainers via its
 * `nextAttemptAt` push-out. Must comfortably exceed the longest expected
 * handler timeout (Resend ~30s, QStash publish ~10s). 5 minutes gives the
 * dispatch + finalize phases plenty of headroom while still recycling
 * stranded rows quickly enough to avoid stuck queues if a worker dies
 * before the finalize tx runs.
 */
export const CLAIM_WINDOW_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Producer API
// ---------------------------------------------------------------------------

/**
 * Inserts an OutboxEvent row inside the given transaction.
 *
 * Returns the inserted row's id, or `null` if the insert was deduped
 * (dedupKey conflict). Callers may use the returned id for trace correlation.
 *
 * When `dedupKey` is set, the unique `(organizationId, dedupKey)`
 * constraint short-circuits double-enqueues at the DB layer instead of via a
 * racy `findFirst` lookup.
 */
export async function enqueueOutboxEvent<TPayload extends Record<string, unknown>>(
  input: EnqueueOutboxEventInput<TPayload>,
): Promise<string | null> {
  const { tx, organizationId, eventType, payload, dedupKey, aggregateType, aggregateId } = input;

  // Generate id client-side so we can return it even when the insert is a
  // no-op due to dedupKey conflict (we still want the caller's logs to
  // correlate with the original row).
  const id = newOutboxId();
  const payloadString = JSON.stringify(payload);

  // ON CONFLICT DO NOTHING swallows the dedupKey collision; rowsAffected===0
  // tells the caller this was a duplicate enqueue.
  // Cast payload to jsonb explicitly — Prisma's tagged template binds string
  // params to text by default.
  const rowsAffected = await tx.$executeRawUnsafe(
    `
    INSERT INTO "OutboxEvent" (
      "id",
      "organizationId",
      "eventType",
      "aggregateType",
      "aggregateId",
      "payloadJson",
      "dedupKey",
      "status",
      "attempts",
      "nextAttemptAt",
      "createdAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'PENDING', 0, NOW(), NOW())
    ON CONFLICT ("organizationId", "dedupKey") DO NOTHING
    `,
    id,
    organizationId,
    eventType,
    aggregateType ?? null,
    aggregateId ?? null,
    payloadString,
    dedupKey ?? null,
  );

  if (rowsAffected === 0) {
    log.debug({ organizationId, eventType, dedupKey }, 'outbox enqueue deduped');
    return null;
  }

  log.debug({ outboxEventId: id, organizationId, eventType, dedupKey }, 'outbox enqueue ok');
  return id;
}

/**
 * Typed convenience wrapper for the `notification.dispatch` event.
 *
 * Producers enqueue a `NotificationEvent` inside their existing
 * `$transaction` so the notification is durably scheduled iff the triggering
 * business write commits — replacing the post-commit fire-and-forget
 * `dispatch(...).catch(...)` shape (at-most-once, lost on a crash between
 * commit and dispatch) with the outbox's at-least-once drain. The handler
 * threads the OutboxEvent.id into `notification-service`, whose
 * `(organizationId, dedupKey)` unique + Resend `Idempotency-Key` collapse a
 * redrive to a single delivery.
 *
 * `dedupKey`, when supplied, dedups the ENQUEUE itself via the
 * `(organizationId, dedupKey)` constraint on `OutboxEvent` — set it to a
 * stable natural key of the announcing state change (e.g.
 * `approval-request:<flowId>`) so a retried producer transaction does not
 * enqueue the same notification twice. Aggregate fields default to the
 * event's entity for trace correlation.
 */
export function enqueueNotificationOutboxEvent(input: {
  tx: OutboxTransactionalClient;
  event: NotificationEvent;
  dedupKey?: string;
}): Promise<string | null> {
  return enqueueOutboxEvent({
    tx: input.tx,
    organizationId: input.event.organizationId,
    eventType: 'notification.dispatch',
    // NotificationEvent is a closed interface (no index signature), so it is
    // not structurally a Record<string, unknown>; the cast is safe because
    // the payload is serialized to jsonb and the handler re-narrows it to
    // NotificationEvent via OutboxEventPayloadMap.
    payload: input.event as unknown as Record<string, unknown>,
    dedupKey: input.dedupKey,
    aggregateType: input.event.entityType,
    aggregateId: input.event.entityId,
  });
}

// ---------------------------------------------------------------------------
// Drain
// ---------------------------------------------------------------------------

/**
 * Pulls up to `DRAIN_BATCH_LIMIT` PENDING events whose nextAttemptAt is past,
 * locks them with `FOR UPDATE SKIP LOCKED` so concurrent drain workers fan
 * out without colliding, then dispatches each through the handler registry.
 *
 * Composition:
 *   1. Claim batch in a short tx — bump attempts, push nextAttemptAt out by
 *      CLAIM_WINDOW_MS so a parallel drainer skips the row.
 *   2. Dispatch each claimed row OUTSIDE any tx — handler side-effects
 *      (Resend, Slack, Stripe, …) run here, never inside a transaction.
 *   3. Finalize each row in its own short tx — DISPATCHED on success, or
 *      FAILED / scheduled retry on failure.
 *
 * Per-event success → status='DISPATCHED'.
 * Per-event transient failure → schedule next attempt with exponential
 * backoff + jitter. Final attempt → status='FAILED' + Sentry capture.
 */
export async function drainOutboxBatch(): Promise<DrainBatchResult> {
  const result: DrainBatchResult = {
    scanned: 0,
    dispatched: 0,
    failed: 0,
    retried: 0,
    exhausted: 0,
  };

  // Step 1 — claim.
  const claimed = await claimOutboxBatch();
  result.scanned = claimed.length;
  if (claimed.length === 0) return result;

  // Phases 2 + 3 — dispatch each row outside any transaction, then finalize
  // its status in its own short transaction. Sequential per row to keep
  // serverless memory bounded; the per-row tx scope prevents one slow
  // handler from blocking other rows' status updates.
  for (const row of claimed) {
    const outcome = await dispatchAndFinalize(row);
    if (outcome === 'dispatched') result.dispatched += 1;
    else if (outcome === 'retried') result.retried += 1;
    else if (outcome === 'exhausted') {
      result.failed += 1;
      result.exhausted += 1;
    }
  }

  return result;
}

/**
 * Step 1 — claim up to DRAIN_BATCH_LIMIT rows under a short transaction.
 *
 * Increments `attempts` and pushes `nextAttemptAt` out by CLAIM_WINDOW_MS
 * so a concurrent drainer's `WHERE nextAttemptAt <= NOW()` predicate won't
 * see these rows. We commit before returning so the row locks released and
 * the next phase runs without holding any DB lock.
 *
 * If the worker crashes between claim and finalize, the row stays PENDING
 * with attempts already bumped; once the claim window expires the next
 * drain tick picks it up naturally (counts toward MAX_OUTBOX_ATTEMPTS).
 */
async function claimOutboxBatch(): Promise<ClaimedOutboxRow[]> {
  return prismaRaw.$transaction(async tx => {
    // FOR UPDATE SKIP LOCKED is the standard outbox primitive: any number of
    // workers can run this query in parallel without selecting the same
    // row. The lock is released on tx end (immediately after the UPDATE
    // below commits).
    const candidates = await tx.$queryRawUnsafe<OutboxEventRow[]>(
      `
      SELECT
        "id",
        "organizationId",
        "eventType",
        "payloadJson",
        "attempts"
      FROM "OutboxEvent"
      WHERE "status" = 'PENDING' AND "nextAttemptAt" <= NOW()
      ORDER BY "createdAt"
      LIMIT $1
      FOR UPDATE SKIP LOCKED
      `,
      DRAIN_BATCH_LIMIT,
    );

    if (candidates.length === 0) return [];

    // Bulk-mark each claimed row: bump attempts and push nextAttemptAt out
    // by CLAIM_WINDOW_MS. We use a single UPDATE … WHERE id = ANY($1) to
    // keep the claim transaction tight (one round-trip rather than N).
    const claimedIds = candidates.map(r => r.id);
    await tx.$executeRawUnsafe(
      `
      UPDATE "OutboxEvent"
      SET "attempts" = "attempts" + 1,
          "nextAttemptAt" = NOW() + ($2 || ' milliseconds')::interval
      WHERE "id" = ANY($1::text[])
      `,
      claimedIds,
      String(CLAIM_WINDOW_MS),
    );

    return candidates.map(r => ({
      id: r.id,
      organizationId: r.organizationId,
      eventType: r.eventType,
      payloadJson: r.payloadJson,
      // We just bumped attempts in the UPDATE above; reflect that locally
      // so downstream MAX_OUTBOX_ATTEMPTS comparisons see the right count.
      attemptNumber: r.attempts + 1,
    }));
  });
}

type RowOutcome = 'dispatched' | 'retried' | 'exhausted';

/**
 * Phases 2 + 3 — dispatch one row outside any transaction, then finalize
 * its status in a fresh short transaction.
 *
 * Returns the outcome label so the caller can update its aggregate counts.
 */
async function dispatchAndFinalize(row: ClaimedOutboxRow): Promise<RowOutcome> {
  // Demo read-only — a demo org's outbox events fire no real side-effects
  // (email / webhooks / notifications). Mark the event done without dispatching
  // so it is not retried, and emit a skip log.
  if (isDemoOrg(row.organizationId)) {
    log.info(
      { outboxEventId: row.id, organizationId: row.organizationId, eventType: row.eventType },
      'demo org — skipping outbox dispatch',
    );
    await finalizeSuccess(row.id);
    return 'dispatched';
  }

  try {
    // Step 2 — handler side-effects, NEVER inside a transaction.
    await dispatchOutboxEvent({
      id: row.id,
      organizationId: row.organizationId,
      eventType: row.eventType as OutboxEventType,
      payload: row.payloadJson,
    });
  } catch (err) {
    return finalizeFailure(row, err);
  }

  // Step 3a — success.
  await finalizeSuccess(row.id);
  return 'dispatched';
}

/** Mark a row DISPATCHED in its own short transaction. */
async function finalizeSuccess(outboxEventId: string): Promise<void> {
  await prismaRaw.$executeRawUnsafe(
    `
    UPDATE "OutboxEvent"
    SET "status" = 'DISPATCHED',
        "dispatchedAt" = NOW(),
        "lastError" = NULL
    WHERE "id" = $1
    `,
    outboxEventId,
  );
}

/**
 * Mark a row FAILED (terminal) or schedule its next retry, in its own
 * short transaction.
 *
 * Note: `attempts` was already incremented during the claim phase, so we
 * do NOT bump it again here. The post-increment count is `row.attemptNumber`.
 */
async function finalizeFailure(row: ClaimedOutboxRow, err: unknown): Promise<RowOutcome> {
  const message = err instanceof Error ? err.message : String(err);
  const truncated = message.slice(0, 1000);

  if (row.attemptNumber >= MAX_OUTBOX_ATTEMPTS) {
    await prismaRaw.$executeRawUnsafe(
      `
      UPDATE "OutboxEvent"
      SET "status" = 'FAILED',
          "failedAt" = NOW(),
          "lastError" = $2
      WHERE "id" = $1
      `,
      row.id,
      truncated,
    );

    log.error(
      {
        err,
        outboxEventId: row.id,
        organizationId: row.organizationId,
        eventType: row.eventType,
        attempts: row.attemptNumber,
      },
      'outbox event exhausted retries — marked FAILED',
    );
    Sentry.captureException(err, {
      tags: {
        'outbox.event_type': row.eventType,
        'outbox.outcome': 'exhausted',
      },
      extra: {
        outboxEventId: row.id,
        organizationId: row.organizationId,
        attempts: row.attemptNumber,
      },
    });
    return 'exhausted';
  }

  const delayMs = computeBackoffMs(row.attemptNumber);
  await prismaRaw.$executeRawUnsafe(
    `
    UPDATE "OutboxEvent"
    SET "lastError" = $2,
        "nextAttemptAt" = NOW() + ($3 || ' milliseconds')::interval
    WHERE "id" = $1
    `,
    row.id,
    truncated,
    String(delayMs),
  );

  log.warn(
    {
      err,
      outboxEventId: row.id,
      organizationId: row.organizationId,
      eventType: row.eventType,
      attempts: row.attemptNumber,
      delayMs,
    },
    'outbox event handler failed — scheduled retry',
  );
  return 'retried';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Exponential backoff with jitter:
 *   base = min(BACKOFF_BASE_MS * 2^(attempts - 1), 1h)
 *   delay = base + random(0, 30s]
 *
 * With BACKOFF_BASE_MS=4m and MAX_OUTBOX_ATTEMPTS=5, the wait sequence is
 * ~4m, 8m, 16m, 32m before the terminal FAILED transition — total wallclock
 * to give up sits near 1h, matching the original retry budget.
 */
export function computeBackoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  // Math.pow guard: 2^60 overflows to Infinity; clamp before multiplying.
  const safeExponent = Math.min(exponent, 30);
  const base = Math.min(BACKOFF_BASE_MS * 2 ** safeExponent, BACKOFF_MAX_MS);
  const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
  return base + jitter;
}

/** Generate a cuid-shaped id without taking a dep on cuid here. */
function newOutboxId(): string {
  // Match the @default(cuid()) shape closely enough for ops-grep parity.
  // Format: oxe_<timestamp36>_<random12>. Length ~ 26.
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
  return `oxe_${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { OutboxEventType } from './handlers';
export { dispatchOutboxEvent } from './handlers';
