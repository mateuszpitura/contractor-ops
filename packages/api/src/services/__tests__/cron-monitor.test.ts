import { resetServerEnvCacheForTesting } from '@contractor-ops/validators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CronMonitors, withCronMonitor } from '../cron-monitor';

describe('cron-monitor', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({ ok: true });
    resetServerEnvCacheForTesting();
    delete process.env.CRONITOR_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call fetch when CRONITOR_API_KEY is unset', async () => {
    const result = await withCronMonitor(CronMonitors.REMINDERS, async () => ({
      ok: true,
    }));
    expect(result).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pings run then complete on success', async () => {
    resetServerEnvCacheForTesting();
    process.env.CRONITOR_API_KEY = 'key-123';

    await withCronMonitor(CronMonitors.REMINDERS, async () => ({ n: 1 }));

    expect(fetchMock).toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes('state=run'))).toBe(true);
    expect(urls.some(u => u.includes('state=complete'))).toBe(true);
  });

  it('pings fail then rethrows on handler error', async () => {
    resetServerEnvCacheForTesting();
    process.env.CRONITOR_API_KEY = 'key-123';

    await expect(
      withCronMonitor(CronMonitors.JOB_HEALTH, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const urls = fetchMock.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes('state=fail'))).toBe(true);
  });
});
