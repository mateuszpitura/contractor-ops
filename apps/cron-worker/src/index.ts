// F-OBS-01: initSentry first — same posture as apps/api/src/index.ts.
import { initSentry, Sentry } from './lib/sentry.js';

initSentry();

import { createLogger } from '@contractor-ops/logger';
import cron from 'node-cron';
import { loadEnv } from './env.js';
import { buildHealthServer } from './health.js';
import { getJobDefinitions } from './jobs/registry.js';
import { runJob } from './jobs/runner.js';

const log = createLogger({ service: 'cron-worker' });

process.on('uncaughtException', err => {
  log.fatal({ err }, 'uncaughtException');
  try {
    Sentry.captureException(err);
    // safe-swallow: secondary Sentry capture failure must not mask the original crash
  } catch {
    // ignore secondary failures
  }
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  log.error({ err: reason }, 'unhandledRejection');
  try {
    Sentry.captureException(reason);
    // safe-swallow: secondary Sentry capture failure must not mask the unhandled rejection
  } catch {
    // ignore
  }
});

async function main(): Promise<void> {
  const env = loadEnv();
  const jobs = getJobDefinitions(env);

  for (const { meta, handler } of jobs) {
    if (!cron.validate(meta.schedule)) {
      throw new Error(`Invalid cron schedule for ${meta.name}: ${meta.schedule}`);
    }
    cron.schedule(meta.schedule, () => {
      void runJob(meta, handler);
    });
    log.info({ job: meta.name, schedule: meta.schedule }, 'scheduled');
  }

  const health = await buildHealthServer();
  await health.listen({ host: env.CRON_HEALTH_HOST, port: env.CRON_HEALTH_PORT });
  log.info(
    { host: env.CRON_HEALTH_HOST, port: env.CRON_HEALTH_PORT, jobCount: jobs.length },
    'cron-worker listening',
  );

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    log.info({ signal }, 'shutdown signal received');
    try {
      await health.close();
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
