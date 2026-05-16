// ---------------------------------------------------------------------------
// Phase 60 · CLASS-08 — /api/cron/classification-reassessment-triggers route.
// ---------------------------------------------------------------------------
//
// Daily cron entry point for the IR35 reassessment trigger scan (AuditLog-
// driven material-change detection). Shell cloned from
// /api/cron/classification-economic-dependency/route.ts:
//   1. verifyCronSecret — Bearer CRON_SECRET auth gate (T-60-07).
//   2. Sentry.withMonitor — schedule + timezone metadata for Sentry crons.
//   3. withCronMonitor   — Cronitor heartbeat pings (run/complete/fail).
//   4. createCronLogger  — structured Pino cron logger (no console.* per CLAUDE.md).

import { CronMonitors, withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { runReassessmentTriggerScan } from '@contractor-ops/api/services/reassessment-trigger-scan';
import { evaluate } from '@contractor-ops/feature-flags';
import { createCronLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withNoStore } from '@/lib/cache-control';

const log = createCronLogger('classification-reassessment-triggers');

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
        endpoint: 'classification-reassessment-triggers',
        skippedAt: new Date().toISOString(),
      },
      'classification-reassessment-triggers cron skipped: flag disabled',
    );
    return withNoStore(NextResponse.json({ skipped: true, reason: 'FLAG_OFF' }));
  }

  const response = await Sentry.withMonitor(
    'classification-reassessment-triggers',
    () =>
      withCronMonitor(CronMonitors.CLASSIFICATION_REASSESSMENT_TRIGGERS, async () => {
        try {
          const result = await runReassessmentTriggerScan();
          log.info(result, 'classification-reassessment-triggers cron completed');
          return NextResponse.json(result);
        } catch (error) {
          log.error({ err: error }, 'classification-reassessment-triggers cron failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'classification-reassessment-triggers' },
          });
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '0 3 * * *' },
      timezone: 'UTC',
    },
  );
  return withNoStore(response);
}

// POST mirrors GET so cron schedulers can pick either verb.
export const POST = GET;
