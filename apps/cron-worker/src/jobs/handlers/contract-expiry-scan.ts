/**
 * Contract lifecycle expiry scan handler.
 *
 * Daily sweep: ACTIVE → EXPIRING within 30 days of endDate; ACTIVE/EXPIRING →
 * EXPIRED once endDate has passed. Delegates to runContractExpiryScan.
 */

import { runContractExpiryScan } from '@contractor-ops/api/services/contract-expiry-scan';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export const contractExpiryScanHandler: JobHandler = async ctx => {
  const start = performance.now();

  try {
    const result = await runContractExpiryScan();
    ctx.log.info(result, 'contract-expiry-scan cron completed');
    return {
      ok: result.errors === 0,
      durationMs: Math.round(performance.now() - start),
      details: { ...result },
    };
  } catch (err) {
    ctx.log.error({ err }, 'contract-expiry-scan cron failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'contract-expiry-scan' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
