/**
 * HRIS two-way sync cron handler.
 *
 * Hourly fan-out across every CONNECTED Personio / BambooHR integration. The
 * service skips connections synced within the last hour, so steady state is
 * "evaluate everything, run the ones past their throttle, skip the rest". Each
 * connection's pull runs inside `tenantStore.run` on its regional client.
 */

import { runScheduledHrisSync } from '@contractor-ops/api/services/hris-sync';
import type { PrismaClient } from '@contractor-ops/db';
import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export const hrisSyncHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const summary = await runScheduledHrisSync({
      prisma,
      getRegionalClient,
      createTenantClientFrom: (p: unknown) => createTenantClientFrom(p as PrismaClient),
      tenantStore,
    });
    ctx.log.info(
      { evaluated: summary.evaluated, ran: summary.ran, skipped: summary.skipped },
      'hris-sync cron completed',
    );
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { ...summary },
    };
  } catch (err) {
    ctx.log.error({ err }, 'hris-sync cron failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'hris-sync' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
