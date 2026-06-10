/**
 * Org-definition sync cron handler.
 *
 * Fans out across every CONNECTED Jira / Linear integration and upserts
 * Project rows + ProjectExternalLinks. The service itself rate-limits to
 * "skip connections that synced within the last 24h" — the cron tick
 * runs nightly so steady state is "evaluate everything, run a small
 * subset, skip the rest".
 */

import { runScheduledOrgDefinitionSync } from '@contractor-ops/api/services/org-definition-sync';
import {
  createTenantClientFrom,
  getRegionalClient,
  prisma,
  type PrismaClient,
  tenantStore,
} from '@contractor-ops/db';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export const orgDefinitionSyncHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const summary = await runScheduledOrgDefinitionSync({
      prisma,
      getRegionalClient,
      createTenantClientFrom: (p: unknown) => createTenantClientFrom(p as PrismaClient),
      tenantStore,
    });
    ctx.log.info(
      { evaluated: summary.evaluated, ran: summary.ran, skipped: summary.skipped },
      'org-definition-sync cron completed',
    );
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { ...summary },
    };
  } catch (err) {
    ctx.log.error({ err }, 'org-definition-sync cron failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'org-definition-sync' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
