import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { refreshExpiring } from '@contractor-ops/integrations';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withNoStore } from '@/lib/cache-control';

const log = createCronLogger('token-refresh');

// ---------------------------------------------------------------------------
// GET /api/cron/token-refresh
// Vercel Cron endpoint — runs every 15 minutes to proactively refresh
// integration tokens expiring within 30 minutes.
// Protected by CRON_SECRET bearer token (set by Vercel for cron jobs).
//
// Cache-Control: no-store, private — internal cron endpoint, never cached.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return withNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const response = await Sentry.withMonitor(
    'token-refresh',
    () =>
      withCronMonitor('token-refresh', async () => {
        try {
          const result = await refreshExpiring();
          log.info(
            { refreshed: result.refreshed, total: result.total, failed: result.failed },
            'token refresh completed',
          );
          metrics.gauge('cron.token_refresh.refreshed', result.refreshed);
          metrics.gauge('cron.token_refresh.failed', result.failed);
          return NextResponse.json(result);
        } catch (error) {
          log.error({ err: error }, 'token refresh failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'token-refresh' },
          });
          return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '*/15 * * * *' },
      timezone: 'UTC',
    },
  );
  return withNoStore(response);
}
