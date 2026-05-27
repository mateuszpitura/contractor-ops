/**
 * Per-request observability middleware for the public REST API.
 *
 * F-OBS-01: emits a structured log line at request entry and exit
 * (with status, duration, requestId, route, method) and seeds an
 * AsyncLocalStorage context so handlers and the error handler can tag
 * downstream logs / Sentry events with the same requestId.
 *
 * Must be registered AFTER Hono's built-in `requestId()` middleware so
 * the id (which honours an inbound `X-Request-Id` header up to 255 chars
 * and falls back to `crypto.randomUUID()`) is available on `c.var`.
 */

import { createLogger } from '@contractor-ops/logger';
import type { MiddlewareHandler } from 'hono';
import { runWithRequestContext } from './request-context.js';

const log = createLogger({ service: 'public-api' });

/**
 * Logs `→ METHOD /path` on entry and `← METHOD /path STATUS Xms` on
 * exit, both bound to the request id. Errors are NOT captured here
 * (the global `onError` handler owns Sentry capture); we just record
 * the duration even when the handler threw, so timeout/error patterns
 * are visible in Pino/Axiom.
 */
export const observabilityMiddleware: MiddlewareHandler = async (c, next) => {
  // Hono's `requestId()` middleware sets `c.var.requestId` and the
  // `X-Request-Id` response header. We pull it here and rebroadcast it
  // through ALS so downstream code (tRPC caller, handlers, error
  // handler) can correlate without an explicit param.
  const requestId = (c.get('requestId') as string | undefined) ?? crypto.randomUUID();
  const method = c.req.method;
  const path = c.req.path;
  const start = performance.now();

  const requestLog = log.child({ requestId, method, path });
  requestLog.info({ url: c.req.url }, `→ ${method} ${path}`);

  try {
    await runWithRequestContext({ requestId }, async () => {
      await next();
    });
  } finally {
    const durationMs = Math.round(performance.now() - start);
    const status = c.res.status;
    requestLog.info({ status, durationMs }, `← ${method} ${path} ${status} ${durationMs}ms`);
  }
};
