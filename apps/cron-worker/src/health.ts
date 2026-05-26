/**
 * Internal /health server for Render's liveness probe.
 *
 * Reports last-success timestamps per job so the probe can flag a worker
 * whose scheduler died but whose process is still alive (the most likely
 * silent-failure mode for a single-instance background worker).
 *
 * Bound to CRON_HEALTH_HOST/PORT — Render exposes this on the private
 * network only; the public internet should never reach it.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { getAllJobStatus } from './jobs/runner.js';

export interface BuildHealthServerOptions {
  host: string;
  port: number;
}

export async function buildHealthServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'cron-worker',
    timestamp: new Date().toISOString(),
    jobs: getAllJobStatus(),
  }));

  return app;
}
