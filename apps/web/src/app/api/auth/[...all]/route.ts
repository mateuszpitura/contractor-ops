import { auth } from '@contractor-ops/auth';
import {
  buildContextFromHeaders,
  createLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import { toNextJsHandler } from 'better-auth/next-js';

/**
 * Better Auth catch-all route. Phase 2 P2-E F-OBS-09.
 *
 * Wraps `toNextJsHandler(auth)` with a thin observability layer that:
 *
 * - Seeds an ALS frame from incoming `x-request-id` / `traceparent` headers
 *   (or mints one when absent), so every Better Auth log line + downstream
 *   Pino call carries the same correlation IDs.
 * - Logs `{ method, path, status, durationMs }` for each request — which
 *   was previously invisible to Pino because the route was 4 lines of pure
 *   Better Auth handler delegation.
 * - Forwards 5xx responses to Sentry so credential-stuffing / OAuth failure
 *   spikes show up as errors instead of silent 401s.
 */

const log = createLogger({ service: 'auth' });

const { GET: rawGet, POST: rawPost } = toNextJsHandler(auth);

type AuthHandler = typeof rawGet;

function safePathname(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return '<invalid-url>';
  }
}

function wrap(method: 'GET' | 'POST', inner: AuthHandler): AuthHandler {
  return async (request: Request) => {
    const traceCtx = buildContextFromHeaders(request.headers);
    const path = safePathname(request);
    const start = performance.now();

    return runWithRequestContext(traceCtx, async () => {
      log.info({ method, path }, 'auth request started');
      try {
        const response = await inner(request);
        const durationMs = Math.round(performance.now() - start);
        const status = response.status;

        if (status >= 500) {
          log.error({ method, path, status, durationMs }, 'auth request failed');
          Sentry.captureMessage(`auth ${method} ${path} returned ${status}`, {
            level: 'error',
            tags: { 'auth.path': path, 'auth.method': method },
            extra: { durationMs },
          });
        } else if (status >= 400) {
          log.warn({ method, path, status, durationMs }, 'auth request rejected');
        } else {
          log.info({ method, path, status, durationMs }, 'auth request completed');
        }

        return response;
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        log.error({ err, method, path, durationMs }, 'auth handler threw');
        Sentry.captureException(err, {
          tags: { 'auth.path': path, 'auth.method': method },
          extra: { durationMs },
        });
        throw err;
      }
    });
  };
}

export const GET = wrap('GET', rawGet);
export const POST = wrap('POST', rawPost);
