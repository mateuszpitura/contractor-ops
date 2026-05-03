// Transactional outbox service (P2-A, F-ASYNC-03 / F-ASYNC-04 / F-DB-23).
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
// Retry policy: see `scheduleNextAttempt`. Exponential backoff with jitter,
// capped at 1 hour, max 10 attempts. After the final attempt the row is
// marked FAILED and a Sentry capture fires.

import { prismaRaw } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { OutboxEventType } from './handlers.js';
import { dispatchOutboxEvent } from './handlers.js';

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
   * notification dedup (F-ASYNC-04): set to e.g.
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** After this many attempts, mark FAILED and Sentry-capture. */
export const MAX_OUTBOX_ATTEMPTS = 10;

/** Per-tick batch cap. Keeps the worker bounded for serverless. */
export const DRAIN_BATCH_LIMIT = 100;

/** Exponential backoff cap. Re-delivery of a flapping handler shouldn't drift past 1h. */
const BACKOFF_MAX_MS = 60 * 60 * 1000;

/** Base unit for exponential backoff: 60s. */
const BACKOFF_BASE_MS = 60 * 1000;

/** Random extra jitter in (0, 30s] to spread thundering herds. */
const JITTER_MAX_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// Producer API
// ---------------------------------------------------------------------------

/**
 * Inserts an OutboxEvent row inside the given transaction.
 *
 * Returns the inserted row's id, or `null` if the insert was deduped
 * (dedupKey conflict). Callers may use the returned id for trace correlation.
 *
 * F-ASYNC-04: when `dedupKey` is set, the unique `(organizationId, dedupKey)`
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

// ---------------------------------------------------------------------------
// Drain
// ---------------------------------------------------------------------------

/**
 * Pulls up to `DRAIN_BATCH_LIMIT` PENDING events whose nextAttemptAt is past,
 * locks them with `FOR UPDATE SKIP LOCKED` so concurrent drain workers fan
 * out without colliding, then dispatches each through the handler registry.
 *
 * Per-event success → status='DISPATCHED'.
 * Per-event transient failure → bump attempts, schedule next attempt with
 * exponential backoff + jitter. Final attempt → status='FAILED' + Sentry
 * capture.
 *
 * The whole drain runs in one prismaRaw $transaction so the row locks are
 * released atomically when the function returns.
 */
export async function drainOutboxBatch(): Promise<DrainBatchResult> {
  return prismaRaw.$transaction(async tx => {
    const result: DrainBatchResult = {
      scanned: 0,
      dispatched: 0,
      failed: 0,
      retried: 0,
      exhausted: 0,
    };

    // FOR UPDATE SKIP LOCKED is the standard outbox primitive: any number of
    // workers can run this query in parallel without selecting the same
    // row. The lock is released on tx end.
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

    result.scanned = candidates.length;
    if (candidates.length === 0) return result;

    for (const row of candidates) {
      try {
        await dispatchOutboxEvent({
          id: row.id,
          organizationId: row.organizationId,
          eventType: row.eventType as OutboxEventType,
          payload: row.payloadJson,
        });

        await tx.$executeRawUnsafe(
          `
          UPDATE "OutboxEvent"
          SET "status" = 'DISPATCHED',
              "dispatchedAt" = NOW(),
              "lastError" = NULL
          WHERE "id" = $1
          `,
          row.id,
        );
        result.dispatched += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const truncated = message.slice(0, 1000);
        const nextAttempts = row.attempts + 1;

        if (nextAttempts >= MAX_OUTBOX_ATTEMPTS) {
          await tx.$executeRawUnsafe(
            `
            UPDATE "OutboxEvent"
            SET "status" = 'FAILED',
                "attempts" = $2,
                "failedAt" = NOW(),
                "lastError" = $3
            WHERE "id" = $1
            `,
            row.id,
            nextAttempts,
            truncated,
          );

          log.error(
            {
              err,
              outboxEventId: row.id,
              organizationId: row.organizationId,
              eventType: row.eventType,
              attempts: nextAttempts,
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
              attempts: nextAttempts,
            },
          });
          result.failed += 1;
          result.exhausted += 1;
          continue;
        }

        const delayMs = computeBackoffMs(nextAttempts);
        await tx.$executeRawUnsafe(
          `
          UPDATE "OutboxEvent"
          SET "attempts" = $2,
              "lastError" = $3,
              "nextAttemptAt" = NOW() + ($4 || ' milliseconds')::interval
          WHERE "id" = $1
          `,
          row.id,
          nextAttempts,
          truncated,
          String(delayMs),
        );

        log.warn(
          {
            err,
            outboxEventId: row.id,
            organizationId: row.organizationId,
            eventType: row.eventType,
            attempts: nextAttempts,
            delayMs,
          },
          'outbox event handler failed — scheduled retry',
        );
        result.retried += 1;
      }
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Exponential backoff with jitter:
 *   base = min(60s * 2^(attempts - 1), 1h)
 *   delay = base + random(0, 30s]
 *
 * The first retry waits ~60s; the cap (~1h) is hit at attempts >= 7.
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

export type { OutboxEventType } from './handlers.js';
export { dispatchOutboxEvent } from './handlers.js';
