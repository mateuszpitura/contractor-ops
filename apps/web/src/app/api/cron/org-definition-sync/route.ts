import { timingSafeEqual } from 'node:crypto';
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { runScheduledOrgDefinitionSync } from '@contractor-ops/api/services/org-definition-sync';
import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createCronLogger('org-definition-sync');

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/org-definition-sync
 *
 * Nightly sync that fans out across every CONNECTED Jira / Linear integration
 * and upserts Project rows + ProjectExternalLinks. Skips connections that
 * already synced within the last 24h (rate-limit lives in the service).
 *
 * Auth: CRON_SECRET bearer token (same pattern as the other cron routes).
 */
export async function GET(request: NextRequest) {
  const cronSecret = getServerEnv().CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    log.error('CRON_SECRET misconfigured — refusing to run org-definition-sync');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;
  const isAuthorized =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Sentry.withMonitor(
    'org-definition-sync',
    () =>
      withCronMonitor('org-definition-sync', async () => {
        try {
          const summary = await runScheduledOrgDefinitionSync({
            prisma,
            getRegionalClient,
            createTenantClientFrom: (p: unknown) =>
              (
                createTenantClientFrom as unknown as (
                  p: unknown,
                ) => ReturnType<typeof createTenantClientFrom>
              )(p),
            tenantStore,
          });
          log.info(
            {
              evaluated: summary.evaluated,
              ran: summary.ran,
              skipped: summary.skipped,
            },
            'org-definition-sync cron completed',
          );
          return NextResponse.json(summary);
        } catch (error) {
          log.error({ err: error }, 'org-definition-sync cron failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'org-definition-sync' },
          });
          return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '0 4 * * *' },
      timezone: 'UTC',
    },
  );
}
