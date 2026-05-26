/**
 * Bank of England base-rate poll handler.
 *
 * Ported from apps/web/src/app/api/cron/boe-rate-poll/route.ts.
 *
 *   1. Feature-flag short-circuit on `payments.late-interest-enabled`.
 *      When off, the rate history is irrelevant because no caller of
 *      `calculateLateInterest` is wired up.
 *   2. `pollBoeBaseRate()` fetches the IUDBEDR series and upserts the
 *      global reference table. The poller never throws — `result.error`
 *      surfaces soft failures (e.g. BoE 403) without turning into a hard
 *      page.
 *
 * Daily cron. Pinned region=EU because BoE rate data is consumed by
 * EU-region late-payment-interest only.
 */

import { evaluate } from '@contractor-ops/feature-flags';
import { pollBoeBaseRate } from '@contractor-ops/integrations/services/boe-base-rate-poller';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const SYSTEM_FLAG_CTX = {
  organizationId: 'system:boe-rate-poll',
  region: 'EU',
  authMode: 'cron',
} as const;

export const boeRatePollHandler: JobHandler = async ctx => {
  const start = performance.now();

  const flag = evaluate('payments.late-interest-enabled', SYSTEM_FLAG_CTX);
  if (!flag.enabled) {
    ctx.log.info(
      { reason: flag.reason },
      'BoE rate poll skipped — payments.late-interest-enabled is off',
    );
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { skipped: true, reason: 'payments.late-interest-enabled is off' },
    };
  }

  try {
    const result = await pollBoeBaseRate();
    if (result.error) {
      ctx.log.warn(
        { result },
        'BoE rate poll completed with soft error — manual entry remains available',
      );
    } else {
      ctx.log.info({ result }, 'BoE rate poll completed');
    }
    return {
      ok: !result.error,
      durationMs: Math.round(performance.now() - start),
      details: {
        updated: result.updated,
        currentRate: result.currentRate,
        ...(result.error ? { error: result.error } : {}),
      },
    };
  } catch (err) {
    ctx.log.error({ err }, 'BoE rate poll failed unexpectedly');
    Sentry.captureException(err, { tags: { 'cron.job': 'boe-rate-poll' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
