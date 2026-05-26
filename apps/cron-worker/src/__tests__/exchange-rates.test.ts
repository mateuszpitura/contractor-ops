/**
 * Unit tests for the `exchange-rates` cron handler.
 *
 * Coverage:
 *   1. CRON_SECRET missing → ok=false (refuses to run).
 *   2. CRON_SECRET too short (<16 chars) → ok=false.
 *   3. Rates stored, no errors → ok=true + gauges emitted.
 *   4. Nothing stored but errors present → ok=false.
 *   5. Some stored despite errors → ok=true (partial success tolerated).
 *   6. tRPC caller throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateCaller, mockFetchDaily, mockGetServerEnv, mockGauge, mockCaptureException } =
  vi.hoisted(() => ({
    mockCreateCaller: vi.fn(),
    mockFetchDaily: vi.fn(),
    mockGetServerEnv: vi.fn(),
    mockGauge: vi.fn(),
    mockCaptureException: vi.fn(),
  }));

vi.mock('@contractor-ops/api', () => ({
  appRouter: {},
  createCallerFactory: () => mockCreateCaller,
  createCronContext: vi.fn((arg: unknown) => arg),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockGauge },
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: mockGetServerEnv,
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { exchangeRatesHandler } from '../jobs/handlers/exchange-rates.js';
import { makeJobContext } from './_helpers.js';

const VALID_SECRET = 'cron-secret-0123456789';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerEnv.mockReturnValue({ CRON_SECRET: VALID_SECRET });
  mockCreateCaller.mockReturnValue({ exchangeRate: { fetchDaily: mockFetchDaily } });
  mockFetchDaily.mockResolvedValue({ stored: 3, errors: [] });
});

describe('exchangeRatesHandler', () => {
  it('returns ok=false when CRON_SECRET is missing', async () => {
    mockGetServerEnv.mockReturnValue({ CRON_SECRET: undefined });

    const result = await exchangeRatesHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'CRON_SECRET misconfigured' });
    expect(mockFetchDaily).not.toHaveBeenCalled();
  });

  it('returns ok=false when CRON_SECRET is too short', async () => {
    mockGetServerEnv.mockReturnValue({ CRON_SECRET: 'short' });

    const result = await exchangeRatesHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'CRON_SECRET misconfigured' });
  });

  it('returns ok=true and emits gauges when rates are stored without errors', async () => {
    mockFetchDaily.mockResolvedValue({ stored: 12, errors: [] });

    const result = await exchangeRatesHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ stored: 12, errors: [] });
    expect(mockGauge).toHaveBeenCalledWith('cron.exchange_rates.stored', 12);
    expect(mockGauge).toHaveBeenCalledWith('cron.exchange_rates.errors', 0);
  });

  it('returns ok=false when nothing was stored and errors occurred', async () => {
    mockFetchDaily.mockResolvedValue({ stored: 0, errors: ['ECB 503'] });

    const result = await exchangeRatesHandler(makeJobContext());

    expect(result.ok).toBe(false);
  });

  it('returns ok=true when some rates were stored despite errors', async () => {
    mockFetchDaily.mockResolvedValue({ stored: 2, errors: ['ME region failed'] });

    const result = await exchangeRatesHandler(makeJobContext());

    expect(result.ok).toBe(true);
  });

  it('returns ok=false and reports to Sentry when the caller throws', async () => {
    mockFetchDaily.mockRejectedValue(new Error('router exploded'));

    const result = await exchangeRatesHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'router exploded' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
