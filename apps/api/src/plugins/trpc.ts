/**
 * tRPC mount under /api/trpc/** (staff) and /api/trpc/portal/** (portal).
 *
 * Reuses `appRouter` + `portalAppRouter` from `@contractor-ops/api` and
 * delegates to `fetchRequestHandler` from `@trpc/server/adapters/fetch`.
 * The Fastify request is bridged to a Web `Request` via
 * `lib/web-bridge.ts` so the handler sees the same shape it does in the
 * legacy Next.js app — no router-level changes are required.
 *
 * Encapsulated plugin: the raw-body content-type parser scoped here only
 * affects /api/trpc/** routes; sibling JSON handlers stay on Fastify's
 * default parser.
 *
 * Behaviour:
 *
 *   - F-SCALE-17 body cap: short-circuit 413 when Content-Length exceeds
 *     `TRPC_MAX_BODY_MB` (default 1 MB). Avoids materializing 10-20 MB
 *     base64 payloads on the V8 heap during DoS / accidental floods.
 *   - F-OBS-15 RED metrics: per-route request count, error count, and
 *     latency distribution tagged with route, method, status class.
 *   - Sentry per-procedure capture via the `onError` hook on the handler;
 *     wrapped in `Sentry.withIsolationScope` so concurrent batched
 *     requests don't smear tags across each other.
 *   - Pino request log lines around each call (request-context is already
 *     bound by the parent `registerRequestContext` hook; the ALS frame
 *     propagates into the handler).
 */

import { appRouter, createContext, portalAppRouter } from '@contractor-ops/api';
import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { loadEnv } from '../env.js';
import { Sentry } from '../lib/sentry.js';
import { sendWebResponse, toWebRequest } from '../lib/web-bridge.js';

const log = createLogger({ service: 'http' });

// `TRPC_MAX_BODY_MB=` (empty) and missing-or-malformed values both fall back
// to the 1 MB default. The Zod schema already coerces + rejects garbage at
// boot; here we only normalize `undefined` (unset) and a non-positive value
// to the 1 MB floor.
function resolveMaxBodyMb(): number {
  const raw = loadEnv().TRPC_MAX_BODY_MB;
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(1, raw);
}

const MAX_BODY_MB = resolveMaxBodyMb();
const MAX_BODY_BYTES = Math.floor(MAX_BODY_MB * 1024 * 1024);

const STAFF_PREFIX = '/api/trpc';
const PORTAL_PREFIX = '/api/trpc/portal';

const trpcPluginImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  // Portal mount goes first so the wildcard staff route does not eat
  // /api/trpc/portal/* paths. Fastify dispatches on exact specificity, but
  // we keep the registration order explicit so the routing matrix is
  // obvious to a reader.
  app.all(`${PORTAL_PREFIX}/*`, (request, reply) =>
    handleTrpcRequest(request, reply, {
      endpoint: PORTAL_PREFIX,
      routerKey: 'portal',
    }),
  );
  app.all(`${STAFF_PREFIX}/*`, (request, reply) => {
    if (request.url.startsWith(`${PORTAL_PREFIX}/`)) return reply.callNotFound();
    return handleTrpcRequest(request, reply, {
      endpoint: STAFF_PREFIX,
      routerKey: 'staff',
    });
  });
};

export const trpcPlugin = trpcPluginImpl;

interface HandleOptions {
  endpoint: typeof STAFF_PREFIX | typeof PORTAL_PREFIX;
  routerKey: 'staff' | 'portal';
}

async function handleTrpcRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  { endpoint, routerKey }: HandleOptions,
): Promise<void> {
  const start = performance.now();
  const method = request.method.toUpperCase();
  const pathname = decodeURIComponent(new URL(absoluteUrl(request)).pathname);
  const procedure = pathname.replace(`${endpoint}/`, '');

  // F-SCALE-17 — reject oversize bodies before fetchRequestHandler reads them.
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const cl = request.headers['content-length'];
    if (typeof cl === 'string') {
      const contentLength = Number.parseInt(cl, 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        log.warn(
          { method, procedure, contentLength, maxBytes: MAX_BODY_BYTES, routerKey },
          '413 request body exceeds configured cap',
        );
        return void reply.code(413).send({
          error: {
            code: -32600,
            message: `Request body exceeds ${MAX_BODY_MB} MB limit. Use presigned R2 uploads for large files.`,
            data: { httpStatus: 413 },
          },
        });
      }
    }
  }

  log.info({ method, procedure, routerKey }, `→ ${method} ${pathname}`);

  const webRequest = toWebRequest(request);
  const router = routerKey === 'staff' ? appRouter : portalAppRouter;

  const webResponse = await Sentry.withIsolationScope(scope => {
    scope.setTag('requestId', request.requestId);
    scope.setTag('trpc.endpoint', routerKey);
    return fetchRequestHandler({
      endpoint,
      req: webRequest,
      router,
      createContext: () => createContext({ headers: webRequest.headers }),
      onError({ error, path: procedurePath }) {
        Sentry.captureException(error, {
          tags: { 'trpc.path': procedurePath ?? procedure, 'trpc.endpoint': routerKey },
          extra: { requestId: request.requestId },
        });
      },
    });
  });

  const durationMs = Math.round(performance.now() - start);
  const status = webResponse.status;

  log.info(
    { method, procedure, status, durationMs, routerKey },
    `← ${method} ${pathname} ${status} ${durationMs}ms`,
  );

  emitRedMetrics(endpoint, method, status, durationMs);

  await sendWebResponse(reply, webResponse);
}

function emitRedMetrics(route: string, method: string, status: number, durationMs: number): void {
  const statusClass = `${Math.floor(status / 100)}xx`;
  metrics.increment('http.request.count', 1, { route, method, status: statusClass });
  if (status >= 500) {
    metrics.increment('http.request.errors', 1, { route, method, status: statusClass });
  }
  metrics.distribution('http.request.duration_ms', durationMs, {
    unit: 'millisecond',
    tags: { route, method, status: statusClass },
  });
}

function absoluteUrl(request: FastifyRequest): string {
  const protocol = (request.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
  const host = request.headers.host ?? 'localhost';
  return `${protocol}://${host}${request.url}`;
}
