// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — /api/cron/classification-economic-dependency route.
// ---------------------------------------------------------------------------
//
// Daily cron entry point for the economic-dependency scan (§2 SGB VI early
// warning). Shell is cloned from /api/cron/reminders/route.ts:
//   1. verifyCronSecret — Bearer CRON_SECRET auth gate (T-60-01).
//   2. Sentry.withMonitor — schedule + timezone metadata for Sentry crons.
//   3. withCronMonitor   — Cronitor heartbeat pings (run/complete/fail).
//   4. createCronLogger  — structured Pino cron logger (no console.* per CLAUDE.md).
//
// The scan orchestrator itself lives in
// packages/api/src/services/economic-dependency-scan.ts.

import { CronMonitors, withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { runEconomicDependencyScan } from '@contractor-ops/api/services/economic-dependency-scan';
import { evaluate } from '@contractor-ops/feature-flags';
import { createCronLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withNoStore } from '@/lib/cache-control';

const log = createCronLogger('classification-economic-dependency');

// Cache-Control: no-store, private — internal cron endpoint, never cached.
export const dynamic = 'force-dynamic';

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return withNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  // Phase 64 D-08 — flag-off early return
  const flagResult = evaluate('module.classification-engine', {
    organizationId: 'CRON',
    region: 'EU', // jurisdiction='ANY' — region doesn't affect evaluation
  });
  if (!flagResult.enabled) {
    log.info(
      {
        event: 'CRON_SKIPPED_FLAG_OFF',
        endpoint: 'classification-economic-dependency',
        skippedAt: new Date().toISOString(),
      },
      'classification-economic-dependency cron skipped: flag disabled',
    );
    return withNoStore(NextResponse.json({ skipped: true, reason: 'FLAG_OFF' }));
  }

  const response = await Sentry.withMonitor(
    'classification-economic-dependency',
    () =>
      withCronMonitor(CronMonitors.CLASSIFICATION_ECONOMIC_DEPENDENCY, async () => {
        try {
          const result = await runEconomicDependencyScan();
          log.info(result, 'classification-economic-dependency cron completed');
          return NextResponse.json(result);
        } catch (error) {
          log.error({ err: error }, 'classification-economic-dependency cron failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'classification-economic-dependency' },
          });
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '0 2 * * *' },
      timezone: 'UTC',
    },
  );
  return withNoStore(response);
}

// POST mirrors GET so cron schedulers can pick either verb.
export const POST = GET;
