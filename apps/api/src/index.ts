// F-OBS-01: initSentry MUST run before any module that might throw, so the
// SDK can wire its OpenTelemetry instrumentation hooks. Keep it as the first
// executable statement of the entrypoint.
import { initSentry, Sentry } from './lib/sentry.js';

initSentry();

import { createLogger } from '@contractor-ops/logger';
import { loadEnv } from './env.js';
import { buildServer } from './server.js';

const log = createLogger({ service: 'api-server' });

// F-OBS-04: process-level error handlers — without these an unhandled
// rejection inside an async hook kills the Fastify server silently and
// Render restarts the pod with no debuggable stack trace anywhere.
process.on('uncaughtException', err => {
  log.fatal({ err }, 'uncaughtException');
  try {
    Sentry.captureException(err);
  } catch {
    // ignore secondary failures so we don't loop on exit.
  }
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  log.error({ err: reason }, 'unhandledRejection');
  try {
    Sentry.captureException(reason);
  } catch {
    // ignore
  }
});

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer({ envOverride: env });

  await app.listen({ host: env.HOST, port: env.PORT });
  log.info({ host: env.HOST, port: env.PORT }, 'api-server listening');

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    log.info({ signal }, 'shutdown signal received');
    try {
      await app.close();
      await Sentry.close(2000);
    } catch (err) {
      log.error({ err }, 'graceful shutdown failed');
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

void main();
