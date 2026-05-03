/**
 * Per-request context for the public REST API.
 *
 * F-OBS-01: a `requestId` minted at middleware entry is stored both on
 * the Hono context (via the built-in `requestId()` middleware) AND in
 * Node `AsyncLocalStorage`, so any downstream code path — tRPC caller,
 * service helpers, even errors caught in `app.onError` — can pull the
 * same id without threading it through every function signature.
 *
 * Use `getRequestId()` from anywhere inside the request lifecycle to
 * tag a log line or error. Returns `undefined` outside a request frame
 * (e.g. cron/startup), which lets callers fall back to a service-level
 * logger.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  requestId: string;
  apiKeyId?: string;
  organizationId?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run `fn` inside a request-scoped ALS frame so `getRequestId()` returns
 * the supplied id everywhere downstream until the frame unwinds.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

/** Returns the active request id, or `undefined` if called outside a request. */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

/** Returns the full active request context, if any. */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
