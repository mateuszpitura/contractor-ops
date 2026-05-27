/**
 * Classification economic-dependency scan handler.
 *
 * Daily §2 SGB VI early-warning scan run by
 * `runEconomicDependencyScan`. Short-circuits when
 * `module.classification-engine` is off (D-08).
 */

import { runEconomicDependencyScan } from '@contractor-ops/api/services/economic-dependency-scan';
import { evaluate } from '@contractor-ops/feature-flags';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const FLAG_CTX = {
  organizationId: 'CRON',
  region: 'EU',
} as const;

export const classificationEconomicDependencyHandler: JobHandler = async ctx => {
  const start = performance.now();

  const flagResult = evaluate('module.classification-engine', FLAG_CTX);
  if (!flagResult.enabled) {
    ctx.log.info(
      {
        event: 'CRON_SKIPPED_FLAG_OFF',
        endpoint: 'classification-economic-dependency',
      },
      'classification-economic-dependency cron skipped: flag disabled',
    );
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { skipped: true, reason: 'FLAG_OFF' },
    };
  }

  try {
    const result = await runEconomicDependencyScan();
    ctx.log.info(result, 'classification-economic-dependency cron completed');
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: result as unknown as Record<string, unknown>,
    };
  } catch (err) {
    ctx.log.error({ err }, 'classification-economic-dependency cron failed');
    Sentry.captureException(err, {
      tags: { 'cron.job': 'classification-economic-dependency' },
    });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
