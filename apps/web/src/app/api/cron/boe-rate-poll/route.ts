// apps/web/src/app/api/cron/boe-rate-poll/route.ts
//
// Phase 63 · Plan 03 · D-09 — Bank of England base rate polling cron route.
//
// Daily entry point for the BoE IUDBEDR series poll. Shell mirrors the
// existing /api/cron/* routes (token-refresh, classification-economic-
// dependency, late-interest-pdf-reaper):
//   1. verifyCronSecret  — Bearer CRON_SECRET auth gate
//   2. payments.late-interest-enabled flag short-circuit
//   3. Sentry.withMonitor — schedule + timezone metadata for Sentry crons
//   4. withCronMonitor   — Cronitor heartbeat pings (run/complete/fail)
//   5. createCronLogger  — structured Pino cron logger (no console.* per CLAUDE.md)
//
// The poller itself lives in
// packages/integrations/src/services/boe-base-rate-poller.ts and is
// pure-fetch + DB-upsert — no HTTP-level coupling to this route.

import { CronMonitors, withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { evaluate } from '@contractor-ops/feature-flags';
import { pollBoeBaseRate } from '@contractor-ops/integrations/services/boe-base-rate-poller';
import { createCronLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withNoStore } from '@/lib/cache-control';

const log = createCronLogger('boe-rate-poll');

// Cache-Control: no-store, private — internal cron endpoint, never cached.
export const dynamic = 'force-dynamic';

/**
 * Auth gate — same pattern as classification-economic-dependency. Tolerant
 * of the `Bearer ` prefix (Vercel Cron sets it; some external schedulers
 * pass the bare token).
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === cronSecret;
}

/**
 * Stable system context for the global feature-flag short-circuit. The
 * BoE poll has no tenant — it updates a global reference table. We use a
 * deterministic placeholder organizationId so Unleash gradual-rollout
 * stickiness is consistent run-to-run, and pin region=EU because BoE rate
 * data is consumed by EU-region late-payment-interest only (jurisdiction
 * on the flag is also EU).
 */
const SYSTEM_FLAG_CTX = {
  organizationId: 'system:boe-rate-poll',
  region: 'EU',
  authMode: 'cron',
} as const;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return withNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  // Feature-flag short-circuit (D-19). PAY_LATE_INTEREST_ENABLED is the
  // umbrella flag — when it is off the rate history is irrelevant because
  // no caller of `calculateLateInterest` is wired up.
  const flag = evaluate('payments.late-interest-enabled', SYSTEM_FLAG_CTX);
  if (!flag.enabled) {
    log.info(
      { reason: flag.reason },
      'BoE rate poll skipped — payments.late-interest-enabled is off',
    );
    return withNoStore(
      NextResponse.json({
        skipped: true,
        reason: 'payments.late-interest-enabled is off',
      }),
    );
  }

  const response = await Sentry.withMonitor(
    'boe-rate-poll',
    () =>
      withCronMonitor(CronMonitors.BOE_RATE_POLL, async () => {
        try {
          const result = await pollBoeBaseRate();
          if (result.error) {
            // Polling never throws — but the worker may have logged a soft
            // failure (e.g. BoE 403). Surface it on the cron response so
            // Sentry / Cronitor pick it up without us turning it into a
            // hard failure that would page the on-call.
            log.warn(
              { result },
              'BoE rate poll completed with soft error — manual entry remains available',
            );
          } else {
            log.info({ result }, 'BoE rate poll completed');
          }
          return NextResponse.json({
            success: true,
            updated: result.updated,
            currentRate: result.currentRate,
            ...(result.error ? { error: result.error } : {}),
          });
        } catch (error) {
          log.error({ err: error }, 'BoE rate poll failed unexpectedly');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'boe-rate-poll' },
          });
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '0 6 * * *' },
      timezone: 'UTC',
    },
  );
  return withNoStore(response);
}

// POST mirrors GET so cron schedulers (Render, Vercel, GitHub Actions,
// curl-from-render-shell) can pick either verb.
export const POST = GET;
