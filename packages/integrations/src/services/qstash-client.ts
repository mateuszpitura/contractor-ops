import { getOutboundHeaders } from '@contractor-ops/logger';
import { Client } from '@upstash/qstash';

// ---------------------------------------------------------------------------
// QStash Client Singleton
// ---------------------------------------------------------------------------

let client: Client | null = null;

/**
 * Returns a singleton QStash client instance.
 * Requires QSTASH_TOKEN environment variable.
 *
 * NOTE — Phase 2 / P2-E (F-OBS-03): callers that want producer→consumer trace
 * correlation should publish via `publishJSONWithContext` (below) instead of
 * calling `client.publishJSON(...)` directly. The wrapper auto-injects the
 * current ALS frame's `x-request-id` and W3C `traceparent` as QStash forward
 * headers so the consumer route can reseed its own ALS frame.
 *
 * Existing direct callers continue to work — only correlation IDs are missing.
 */
export function getQStashClient(): Client {
  if (!client) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) {
      throw new Error('QSTASH_TOKEN environment variable is not set');
    }
    // QSTASH_URL points at the local QStash dev server in development
    // (e.g. http://localhost:8089). Unset in production → SDK defaults to
    // https://qstash.upstash.io.
    const baseUrl = process.env.QSTASH_URL;
    client = new Client(baseUrl ? { token, baseUrl } : { token });
  }
  return client;
}

/**
 * Resets the singleton client. Useful for testing.
 */
export function resetQStashClient(): void {
  client = null;
}

// ---------------------------------------------------------------------------
// publishJSON wrapper with trace propagation (F-OBS-03)
// ---------------------------------------------------------------------------

type PublishJSONArgs = Parameters<Client['publishJSON']>[0];
type PublishJSONResult = ReturnType<Client['publishJSON']>;

/**
 * Forward-header set used by QStash to deliver custom headers to the
 * consumer endpoint. Per Upstash docs, headers prefixed with
 * `Upstash-Forward-` are stripped from the prefix before being delivered.
 *
 * We forward `x-request-id` (always when ALS frame active) and
 * `traceparent` / `tracestate` when set, so the consumer route can read
 * them via `request.headers.get('x-request-id')` and reseed ALS.
 */
function buildForwardHeaders(): Record<string, string> {
  const ctxHeaders = getOutboundHeaders();
  const forwarded: Record<string, string> = {};
  for (const [name, value] of Object.entries(ctxHeaders)) {
    forwarded[`Upstash-Forward-${name}`] = value;
  }
  return forwarded;
}

/**
 * Publishes a QStash message with the current request's correlation IDs
 * forwarded as request headers to the consumer endpoint.
 *
 * Use this in producer code (routers, services, cron triggers) anywhere a
 * QStash hop crosses an async boundary. The consumer route must read the
 * incoming `x-request-id` / `traceparent` headers via
 * `buildContextFromHeaders(request.headers)` and seed ALS via
 * `runWithRequestContext` so logs on both sides correlate.
 *
 * Falls back to the unmodified args (no extra headers) when no ALS frame is
 * active — safe for cron-triggered enqueues that have no upstream request.
 */
export function publishJSONWithContext(args: PublishJSONArgs): PublishJSONResult {
  const forwarded = buildForwardHeaders();
  const merged: PublishJSONArgs =
    Object.keys(forwarded).length === 0
      ? args
      : { ...args, headers: { ...(args.headers ?? {}), ...forwarded } };
  return getQStashClient().publishJSON(merged);
}
