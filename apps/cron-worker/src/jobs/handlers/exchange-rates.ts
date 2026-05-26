/**
 * Exchange-rates cron handler.
 *
 * Ported from apps/web/src/app/api/cron/exchange-rates/route.ts. Daily
 * ECB sync — calls `exchangeRate.fetchDaily` via a cron-scoped tRPC
 * caller. The procedure fans out across `SUPPORTED_REGIONS` and
 * aggregates per-region errors; the handler relays the result and emits
 * `cron.exchange_rates.{stored,errors}` gauges.
 *
 * The legacy route required a CRON_SECRET bearer header so the
 * cronProcedure middleware would accept it. In cron-worker we call the
 * procedure in-process, so we synthesise the same `Authorization:
 * Bearer ${CRON_SECRET}` header that the middleware expects.
 */

import { appRouter, createCallerFactory, createCronContext } from '@contractor-ops/api';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const createCaller = createCallerFactory(appRouter);

export const exchangeRatesHandler: JobHandler = async ctx => {
  const start = performance.now();
  const cronSecret = getServerEnv().CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    ctx.log.error('CRON_SECRET misconfigured — refusing to run exchange-rates sync');
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: 'CRON_SECRET misconfigured' },
    };
  }

  try {
    const cronHeaders = new Headers({ authorization: `Bearer ${cronSecret}` });
    const caller = createCaller(createCronContext({ headers: cronHeaders }));
    const result = await caller.exchangeRate.fetchDaily();

    ctx.log.info(
      { stored: result.stored, errorCount: result.errors.length },
      'exchange-rates sync completed',
    );
    metrics.gauge('cron.exchange_rates.stored', result.stored);
    metrics.gauge('cron.exchange_rates.errors', result.errors.length);

    const ok = !(result.stored === 0 && result.errors.length > 0);
    return {
      ok,
      durationMs: Math.round(performance.now() - start),
      details: { stored: result.stored, errors: result.errors },
    };
  } catch (err) {
    ctx.log.error({ err }, 'exchange-rates cron failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'exchange-rates' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
