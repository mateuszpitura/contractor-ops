/**
 * Per-request context stored in Node's native AsyncLocalStorage.
 *
 * Phase 2 / Unit P2-E (F-OBS-02). Seeds a context frame at procedure / route
 * entry and exposes `requestId` + W3C `traceparent` to every nested call —
 * including module-scoped Pino loggers that previously had no per-request
 * binding (audit ref `05-observability.md` §F-OBS-02).
 *
 * Decisions (locked in NEXT-PHASE-PLAN.md / MARKET-SCAN.md §P2-E):
 *
 * - Native `node:async_hooks` (no `cls-hooked`). Works in Next.js / Node 20+ /
 *   the QStash consumer routes; well-trodden production pattern.
 * - We do NOT add `@opentelemetry/sdk-node` — Sentry's built-in fetch / http
 *   instrumentation already covers cross-process trace propagation when
 *   `propagateTraceparent: true` is set in the Sentry config. ALS only has to
 *   reseed the `traceparent` (and our human-readable `x-request-id`) when
 *   crossing the QStash boundary, which is a 5-LOC injection on the producer
 *   side and a 5-LOC read on the consumer side.
 * - `requestId` is UUID v7 when supported (time-sortable for log analysis);
 *   falls back to plain `crypto.randomUUID()` (v4) on older runtimes.
 * - The companion Pino `mixin` (wired in `index.ts`) reads from this ALS so
 *   every log line emitted while a frame is active automatically carries
 *   `{ requestId, traceparent }`. No router/service edits required.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Frame shape
// ---------------------------------------------------------------------------

export interface RequestContext {
  /** Human-readable request identifier (UUID v7 when available). */
  requestId: string;

  /**
   * W3C trace context header — `00-<trace-id>-<span-id>-<flags>`.
   *
   * When present, downstream HTTP / QStash hops should propagate this header
   * verbatim so Sentry / OTel can stitch the trace end-to-end.
   */
  traceparent?: string;

  /**
   * Optional W3C `tracestate` header. We do not generate one ourselves but
   * forward it intact when received from upstream.
   */
  tracestate?: string;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const storage = new AsyncLocalStorage<RequestContext>();

// ---------------------------------------------------------------------------
// UUID v7 generator (with v4 fallback)
// ---------------------------------------------------------------------------

interface RandomUUIDOptions {
  version?: 'v4' | 'v7';
}

type RandomUUIDFn = (options?: RandomUUIDOptions) => string;

/**
 * Generates a UUID v7 (time-sortable) when the runtime supports it; otherwise
 * falls back to UUID v4. Node 20.10+ / 22+ accept the `{ version: 'v7' }`
 * option on `crypto.randomUUID`. Older runtimes silently ignore the option
 * (returning v4) which is acceptable — all we lose is sortability.
 */
export function generateRequestId(): string {
  try {
    return (randomUUID as RandomUUIDFn)({ version: 'v7' });
  } catch {
    return randomUUID();
  }
}

// ---------------------------------------------------------------------------
// W3C traceparent helpers
// ---------------------------------------------------------------------------

const TRACEPARENT_REGEX = /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/**
 * Returns true when the given string looks like a valid W3C `traceparent`.
 * Cheap structural check — does not attempt to verify trace flags / version.
 */
export function isValidTraceparent(value: unknown): value is string {
  return typeof value === 'string' && TRACEPARENT_REGEX.test(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs `fn` inside a fresh ALS frame seeded with the given context.
 *
 * Use at the entrypoint of every request-shaped boundary:
 *
 * - tRPC observability middleware (per-procedure)
 * - QStash consumer route handlers (per-job)
 * - HTTP route handlers that need correlation (auth, webhook, health)
 *
 * `requestId` defaults to a freshly minted UUID v7 if not supplied.
 */
export function runWithRequestContext<T>(context: Partial<RequestContext>, fn: () => T): T {
  const frame: RequestContext = {
    requestId: context.requestId ?? generateRequestId(),
    ...(context.traceparent ? { traceparent: context.traceparent } : {}),
    ...(context.tracestate ? { tracestate: context.tracestate } : {}),
  };
  return storage.run(frame, fn);
}

/**
 * Convenience overload: seed only a `requestId` (string) plus the function.
 * Equivalent to `runWithRequestContext({ requestId }, fn)`.
 */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return runWithRequestContext({ requestId }, fn);
}

/**
 * Returns the current request context, or `undefined` if no frame is active.
 *
 * Returning the full object (not just `requestId`) lets callers grab
 * `traceparent` for outbound header injection without a second lookup.
 */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Returns the current request id, or `undefined` if no frame is active.
 *
 * Pino's `mixin` calls this on every log line; it MUST be cheap and never
 * throw. Wrapping in try/catch keeps a corrupt store from breaking logging.
 */
export function getRequestId(): string | undefined {
  try {
    return storage.getStore()?.requestId;
  } catch {
    return;
  }
}

/**
 * Returns the current W3C `traceparent`, or `undefined` if no frame is active
 * or if the upstream did not supply one.
 */
export function getTraceparent(): string | undefined {
  try {
    return storage.getStore()?.traceparent;
  } catch {
    return;
  }
}

/**
 * Returns the current W3C `tracestate`, or `undefined`.
 */
export function getTracestate(): string | undefined {
  try {
    return storage.getStore()?.tracestate;
  } catch {
    return;
  }
}

/**
 * Reads incoming `traceparent` / `x-request-id` / `tracestate` headers from a
 * standard `Headers` (or any `{ get(name): string | null }`-shaped) object.
 *
 * Used by QStash consumer routes / auth route to seed an ALS frame from the
 * upstream caller's correlation IDs. Falls back to a freshly generated
 * `requestId` if upstream did not supply one.
 */
export function buildContextFromHeaders(headers: {
  get(name: string): string | null;
}): RequestContext {
  const incomingRequestId = headers.get('x-request-id');
  const incomingTraceparent = headers.get('traceparent');
  const incomingTracestate = headers.get('tracestate');

  const requestId =
    incomingRequestId && incomingRequestId.trim().length > 0
      ? incomingRequestId.trim()
      : generateRequestId();

  const traceparent = isValidTraceparent(incomingTraceparent) ? incomingTraceparent : undefined;
  const tracestate =
    typeof incomingTracestate === 'string' && incomingTracestate.length > 0
      ? incomingTracestate
      : undefined;

  return {
    requestId,
    ...(traceparent ? { traceparent } : {}),
    ...(tracestate ? { tracestate } : {}),
  };
}

/**
 * Builds the outgoing header set that propagates the current ALS frame to a
 * downstream service (QStash, integration HTTP, etc).
 *
 * Always emits `x-request-id` (our human-readable UUID v7). Forwards
 * `traceparent` / `tracestate` only when present in the current frame so we
 * never inject a syntactically valid but semantically empty trace header.
 */
export function getOutboundHeaders(): Record<string, string> {
  const ctx = getRequestContext();
  if (!ctx) return {};
  const out: Record<string, string> = { 'x-request-id': ctx.requestId };
  if (ctx.traceparent) out.traceparent = ctx.traceparent;
  if (ctx.tracestate) out.tracestate = ctx.tracestate;
  return out;
}
