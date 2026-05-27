/**
 * Better Auth mount under /api/auth/**.
 *
 * Bridges Better Auth's universal Web fetch handler (`auth.handler(Request)`)
 * onto Fastify by translating `FastifyRequest → Request` and
 * `Response → FastifyReply`. Avoids `reply.hijack()` so CORS, helmet,
 * request-context, and rate-limit hooks keep firing on auth responses.
 *
 * Encapsulated as a Fastify plugin so the raw-body content-type parser
 * (`*\/*` → Buffer) does not leak to sibling routes that expect JSON
 * parsing.
 *
 * Observability wrapper:
 *
 *   - Per-request `{ method, path, status, durationMs }` Pino log.
 *   - 5xx auth responses forwarded to Sentry (credential-stuffing /
 *     OAuth-failure spikes surface as errors, not silent 401s).
 *   - ALS frame is already bound by `registerRequestContext` at the parent
 *     scope — every log line emitted by Better Auth + downstream handlers
 *     inherits `{ requestId }`.
 */

import { captureEvent } from '@contractor-ops/api/services/posthog';
import { auth } from '@contractor-ops/auth';
import { createLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { Sentry } from '../lib/sentry.js';
import { sendWebResponse, toWebRequest } from '../lib/web-bridge.js';

const log = createLogger({ service: 'auth' });

const AUTH_PREFIX = '/api/auth';

/**
 * Parse the user id out of a successful Better Auth `/sign-up/email`
 * response. Better Auth returns `{ user: { id, ... }, token?: ... }`;
 * any other shape (or a non-2xx) means "do not emit a signup event".
 */
async function extractSignupUserId(webResponse: Response): Promise<string | null> {
  if (webResponse.status >= 300) return null;
  try {
    const body = (await webResponse.clone().json()) as { user?: { id?: unknown } };
    const id = body?.user?.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

const authPluginImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Better Auth expects raw bytes / JSON / urlencoded payloads it parses
  // itself. Override Fastify's default JSON parser so the bridged Web
  // Request body contains the unparsed buffer.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  app.all(`${AUTH_PREFIX}/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    const start = performance.now();
    const path = request.url;
    const method = request.method as
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'DELETE'
      | 'PATCH'
      | 'OPTIONS'
      | 'HEAD';

    try {
      const webRequest = toWebRequest(request);
      const webResponse = await auth.handler(webRequest);

      const durationMs = Math.round(performance.now() - start);
      const status = webResponse.status;

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

      // Conversion analytics — fire `signup_completed` once on a
      // successful email sign-up. The capture is best-effort: failures
      // log + breadcrumb but never block the auth response. Anonymous
      // distinct-id stitching is deferred to the SPA-side
      // `posthog.identify(user.id)` call (run on the first session-load
      // after sign-in) — that path runs in the browser where the
      // anonymous PostHog cookie / localStorage entry actually lives.
      if (path.endsWith('/sign-up/email') && method === 'POST' && status >= 200 && status < 300) {
        const userId = await extractSignupUserId(webResponse);
        if (userId) {
          captureEvent({
            distinctId: userId,
            event: 'signup_completed',
            properties: { source: 'auth.sign-up.email' },
          }).catch(err => {
            log.warn({ err, userId }, 'signup_completed posthog capture failed');
          });
        }
      }

      await sendWebResponse(reply, webResponse);
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

/**
 * Encapsulated by default (NOT wrapped in fastify-plugin) so the raw-body
 * content-type parser stays scoped to the /api/auth/** sub-tree and does
 * not break JSON parsing on sibling routes (tRPC, webhooks, csp-report).
 */
export const authPlugin = authPluginImpl;

// toWebRequest + sendWebResponse live in lib/web-bridge.ts and are shared
// with the tRPC mount (apps/api/src/plugins/trpc.ts).
