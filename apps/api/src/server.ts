/**
 * Fastify app factory.
 *
 * `buildServer()` returns a fully-wired Fastify instance with security
 * baseline plugins registered (request-context, helmet, cors, rate-limit,
 * cookie, sensible, sentry hooks) and the health routes mounted. It does
 * NOT listen — `index.ts` owns process lifecycle so unit tests can mount
 * the same app via `await app.inject(...)` without bringing up a socket.
 */

import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadEnv } from './env.js';
import { authPlugin } from './plugins/auth.js';
import { registerCors } from './plugins/cors.js';
import { registerCsrfOriginGuard } from './plugins/csrf-origin.js';
import { registerHelmet } from './plugins/helmet.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerRequestContext } from './plugins/request-context.js';
import { registerSentryHooks } from './plugins/sentry.js';
import { trpcPlugin } from './plugins/trpc.js';
import { registerCspReportRoute } from './routes/csp-report.js';
import { registerExportsRoute } from './routes/exports.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerOAuthRoutes } from './routes/oauth.js';
import { registerPortalSessionRoutes } from './routes/portal-session.js';
import { registerTeamsMessagesRoute } from './routes/teams.js';
import { registerWebVitalsRoute } from './routes/web-vitals.js';
import { webhookPlugin } from './routes/webhooks/index.js';

export interface BuildServerOptions {
  /** Override the parsed env (tests). When omitted, `loadEnv()` is used. */
  envOverride?: ReturnType<typeof loadEnv>;
}

export async function buildServer({
  envOverride,
}: BuildServerOptions = {}): Promise<FastifyInstance> {
  const env = envOverride ?? loadEnv();

  const app = Fastify({
    logger: false, // we use @contractor-ops/logger (Pino) via per-route loggers
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024, // 5 MiB — webhook payloads (KSeF) can be large
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Order matters:
  //   1. request-context — every later hook sees `request.requestId` + ALS.
  //   2. helmet — sets CSP/COOP/CORP/HSTS/etc. on the eventual response.
  //   3. cors — must register *before* routes so preflight handlers wire up.
  //   4. cookie — Better Auth + portal session helpers read/write here.
  //   5. sensible — surfaces httpErrors helpers for route handlers.
  //   6. rate-limit — runs as preHandler; rejects throttled traffic early.
  //   7. sentry hooks — replaces the default errorHandler last so plugin-
  //      registered error paths still flow through it.
  registerRequestContext(app);
  await registerHelmet(app, env);
  await registerCors(app, env);
  await app.register(cookie);
  await app.register(sensible);
  await registerRateLimit(app, env);
  // CSRF origin guard runs as preHandler; exempts /webhooks/** + /health.
  // Better Auth's own CSRF token check is defense-in-depth alongside this.
  // Mirror the CORS plugin: accept APP_URL plus PUBLIC_APP_URL (dev =
  // localhost:3000 alongside the ngrok APP_URL tunnel) so local SPA
  // mutations are not blocked at the origin guard. The CORS allowlist
  // already does the same — keep the two surfaces in lockstep.
  registerCsrfOriginGuard(app, {
    allowedOrigins: [env.APP_URL, ...(env.PUBLIC_APP_URL ? [env.PUBLIC_APP_URL] : [])],
  });
  registerSentryHooks(app);

  // Browsers send CSP violation reports under non-standard Content-Type
  // headers Fastify doesn't parse by default. Register both shapes as
  // JSON so the csp-report handler receives a parsed object. Scope is the
  // root app — these MIME types are not used by tRPC / webhook routes.
  app.addContentTypeParser(
    ['application/csp-report', 'application/reports+json'],
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, body ? JSON.parse(body as string) : null);
      } catch {
        // Don't fail the request — csp-report handler returns 204 either
        // way (it logs unrecognised shapes and never asks the browser to
        // retry on a hot path).
        done(null, body);
      }
    },
  );

  registerHealthRoutes(app);
  registerCspReportRoute(app);
  registerWebVitalsRoute(app);
  registerPortalSessionRoutes(app);
  registerExportsRoute(app);
  // Bot Framework messaging — Bot Framework's `process()` owns JWT
  // validation, so authn is independent of the QStash/HMAC webhook scope.
  registerTeamsMessagesRoute(app);
  // OAuth start + callback — GET routes; Better Auth session check inside.
  registerOAuthRoutes(app);

  // Webhook routes (Stripe + follow-up providers) — encapsulated plugin
  // owns the raw-body content-type parser so HMAC signature verification
  // sees the exact bytes the upstream signed over.
  await app.register(webhookPlugin);

  // Better Auth catch-all under /api/auth/** — encapsulated plugin so its
  // raw-body content-type parser stays scoped (does not break JSON parsing
  // on tRPC / webhook routes registered elsewhere).
  await app.register(authPlugin);

  // tRPC mount: staff /api/trpc/** + portal /api/trpc/portal/**.
  // Encapsulated for the same reason as authPlugin — raw-body parser
  // stays scoped to the prefix.
  await app.register(trpcPlugin);

  return app;
}
