import { timingSafeEqual } from 'node:crypto';
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { fetchAndStoreRates } from '@contractor-ops/api/services/exchange-rate';
import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createCronLogger('exchange-rates');

// ---------------------------------------------------------------------------
// GET /api/cron/exchange-rates
//
// Daily ECB exchange-rate sync — fetches the published rates once and
// persists them into each regional database. Mirrors the cronProcedure
// at `exchangeRate.fetchDaily` in @contractor-ops/api but is wired as a
// dedicated HTTP cron route so the Render cron service can target it
// directly (the rest of the cron jobs in this app follow the same
// `/api/cron/<name>` convention).
//
// Per-tenant read paths (`getRate(...)`, `convertAmount(...)`) consume
// the stored rows directly from the service module; no FE-facing
// exchange-rate procedure exists by design.
//
// Protected by CRON_SECRET bearer token (set by Render for cron jobs).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const cronSecret = getServerEnv().CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    log.error('CRON_SECRET misconfigured — refusing to run exchange-rates sync');
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
    'exchange-rates',
    () =>
      withCronMonitor('exchange-rates', async () => {
        const errors: string[] = [];
        let stored = 0;

        for (const region of SUPPORTED_REGIONS) {
          try {
            const r = await fetchAndStoreRates(getRegionalClient(region));
            stored += r.stored;
            for (const e of r.errors) {
              errors.push(`[${region}] ${e}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`[${region}] ${msg}`);
            log.error({ err, region }, 'regional exchange-rate fetch failed');
            Sentry.captureException(err, {
              tags: { 'cron.job': 'exchange-rates', region },
            });
          }
        }

        log.info(
          { stored, errorCount: errors.length, regions: SUPPORTED_REGIONS.length },
          'exchange-rates sync completed',
        );
        metrics.gauge('cron.exchange_rates.stored', stored);
        metrics.gauge('cron.exchange_rates.errors', errors.length);

        if (stored === 0 && errors.length > 0) {
          return NextResponse.json({ stored, errors }, { status: 500 });
        }
        return NextResponse.json({ stored, errors });
      }),
    {
      schedule: { type: 'crontab', value: '0 6 * * *' },
      timezone: 'UTC',
    },
  );
}
