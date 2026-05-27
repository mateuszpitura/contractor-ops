/**
 * Token refresh cron handler.
 *
 * Calls the `refreshExpiring` service from `@contractor-ops/integrations` which
 * scans every CONNECTED IntegrationConnection whose token will expire
 * within the configured leeway and refreshes them via the per-provider
 * adapter. Failures are aggregated in the return value and a
 * `cron.token_refresh.{refreshed,failed}` gauge is emitted on every
 * tick so dashboards can chart rolling state.
 */

import { refreshExpiring } from '@contractor-ops/integrations';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export const tokenRefreshHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const result = await refreshExpiring();
    ctx.log.info(
      { refreshed: result.refreshed, total: result.total, failed: result.failed },
      'token refresh completed',
    );
    metrics.gauge('cron.token_refresh.refreshed', result.refreshed);
    metrics.gauge('cron.token_refresh.failed', result.failed);
    return {
      ok: result.failed === 0,
      durationMs: Math.round(performance.now() - start),
      details: { refreshed: result.refreshed, total: result.total, failed: result.failed },
    };
  } catch (err) {
    ctx.log.error({ err }, 'token refresh failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'token-refresh' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
