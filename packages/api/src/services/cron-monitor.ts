/**
 * Cron job monitoring via Cronitor heartbeats.
 *
 * Cronitor API: https://cronitor.io/docs/heartbeat-api
 * Each cron job has a monitor key. On each run we ping:
 *   - `run`      — job started
 *   - `complete` — job finished successfully
 *   - `fail`     — job failed
 *
 * If CRONITOR_API_KEY is not set, all pings are silently skipped (dev-friendly).
 */

const CRONITOR_PING_URL = 'https://cronitor.link/p';

/** Cronitor monitor keys — mapped to cron route names. */
export const CronMonitors = {
  REMINDERS: 'reminders',
  TOKEN_REFRESH: 'token-refresh',
  TRIAL_NOTIFICATIONS: 'trial-notifications',
  JOB_HEALTH: 'job-health',
} as const;

export type CronMonitorKey = (typeof CronMonitors)[keyof typeof CronMonitors];

type PingState = 'run' | 'complete' | 'fail';

/**
 * Send a heartbeat ping to Cronitor. Fire-and-forget — never throws.
 */
async function ping(monitorKey: string, state: PingState, message?: string): Promise<void> {
  const apiKey = process.env.CRONITOR_API_KEY;
  if (!apiKey) return;

  const url = new URL(`${CRONITOR_PING_URL}/${apiKey}/${monitorKey}`);
  url.searchParams.set('state', state);
  if (message) {
    url.searchParams.set('msg', message.slice(0, 2000));
  }

  try {
    await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Monitoring failure should never break the cron job itself
  }
}

/**
 * Wraps a cron job handler with Cronitor heartbeat pings.
 *
 * Usage:
 * ```ts
 * const result = await withCronMonitor("reminders", async () => {
 *   // ... cron logic ...
 *   return { processed: 5, sent: 3 };
 * });
 * ```
 */
export async function withCronMonitor<T>(
  monitorKey: CronMonitorKey,
  fn: () => Promise<T>,
): Promise<T> {
  await ping(monitorKey, 'run');

  try {
    const result = await fn();
    const message =
      typeof result === 'object' && result !== null ? JSON.stringify(result) : String(result);
    await ping(monitorKey, 'complete', message);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ping(monitorKey, 'fail', message);
    throw error;
  }
}
