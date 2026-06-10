// Sentry MUST be initialized before any other module so the SDK can wire
// its OpenTelemetry instrumentation hooks. Keep this as the first
// executable statement of the entrypoint.
import { initSentry, Sentry } from './lib/sentry.js';

initSentry();

import { preWarmRegionalClients } from '@contractor-ops/db';
import { assertFlagSignoffsOrExit } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { serve } from '@hono/node-server';
import app from './app.js';

const log = createLogger({ service: 'public-api' });

// ---------------------------------------------------------------------------
// Process-level error handlers
// ---------------------------------------------------------------------------
//
// Without these, an unhandled rejection inside an async handler kills the
// Hono server silently — Render restarts the pod, but on-call sees only the
// symptom (cron jobs stop, integrations expire) without the cause. We log
// at fatal/error and forward to Sentry so the stack trace lands somewhere
// debuggable. `uncaughtException` exits with code 1 (Node best practice —
// the process is in an unknown state); `unhandledRejection` does not exit
// to preserve historical behaviour, but is reported.

process.on('uncaughtException', err => {
  log.fatal({ err }, 'uncaughtException');
  try {
    Sentry.captureException(err);
    // safe-swallow: already logged at fatal above; a failing Sentry capture must not throw from the exit path that follows
  } catch {
    // Sentry capture itself failed — don't loop, just exit.
  }
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  log.error({ err: reason }, 'unhandledRejection');
  try {
    Sentry.captureException(reason);
    // safe-swallow: already logged at error above; a failing Sentry capture must not itself raise inside the rejection handler
  } catch {
    // ignore secondary failures
  }
});

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

const required = ['API_KEY_HMAC_SECRET'] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. See .env.example.`);
  }
}

// Public API rate limiting requires a shared store in production. The in-memory
// limiter is best-effort only and will under-enforce on multi-instance deploys.
if (process.env.NODE_ENV === 'production') {
  const hasRedis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  if (!hasRedis) {
    log.fatal(
      { hasRedis: false },
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production',
    );
    process.exit(1);
  }
}

// Fail-closed flag-signoff gate. Exits(1) if any gated flag is missing its
// signoff-registry entry (FLAG_SIGNOFF_BYPASS=local downgrades to a warn for
// local dev). Run after required-env validation, before serving.
assertFlagSignoffsOrExit();

const PORT = Number(process.env.PUBLIC_API_PORT ?? 4100);

// Pre-warm regional Prisma clients before accepting requests
await preWarmRegionalClients();

serve({
  fetch: app.fetch,
  port: PORT,
});

log.info({ port: PORT }, 'enterprise REST API listening');
